import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth/web-extension";
import { sendGAEvent } from "../utils/analytics";


const IS_DEV = import.meta.env.DEV;
const FRONTEND_URL = IS_DEV ? "http://localhost:3000" : "https://app.getvostra.com";
const API_BASE_URL = IS_DEV ? "http://localhost:3010/v1" : "https://api.getvostra.com/v1";

if (!IS_DEV)
{
    console.log = () => { };
}


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let lastToken = null;
let signingIn = false;
let lastSuccessfulToken = null;

// ======================================================================
// AUTO SIGN-IN WHEN COOKIE CHANGES
// ======================================================================

chrome.cookies.onChanged.addListener(async ({ cookie, removed }) =>
{
    if (cookie.name !== "vostraExtensionToken") return;

    if (removed)
    {
        console.log("vostraExtensionToken cookie removed — signing out");
        lastToken = null;
        return; // Firebase onAuthStateChanged will handle cleanup
    }

    if (cookie.value === lastToken)
    {
        console.log("Cookie unchanged, ignoring");
        return;
    }

    if (signingIn)
    {
        console.log("Already signing in, ignoring cookie change for now");
        return;
    }

    console.log("New token detected, re-authenticating...");
    lastToken = cookie.value;
    await ensureAuthenticated();
});


// =================================================================================================
// Content Messages
// =================================================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{
    if (message.type === "GET_AUTH_STATE")
    {
        (async function ()
        {
            try
            {
                const user = await ensureAuthenticated();
                if (!user) throw new Error("Not signed in");

                sendResponse({ success: true, uid: user.uid });
            }
            catch (err)
            {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true; // keep channel open
    }

    if (message.type === "GET_TEAMS")
    {
        (async function ()
        {
            try
            {
                const user = await ensureAuthenticated();
                if (!user) throw new Error("Not signed in");

                const token = await user.getIdToken(true);
                const teams = await api.fetchTeams(token)

                sendResponse({ success: true, teams });
            }
            catch (err)
            {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true; // keep channel open for async
    }

    if (message.type === "GET_PROMPTS")
    {
        (async function ()
        {
            try
            {
                const user = await ensureAuthenticated();
                if (!user)
                {
                    console.log("User not signed in")
                    throw new Error("Not signed in");
                }

                const token = await user.getIdToken(true);
                const teamsWithPrompts = await api.fetchTeamsWithPrompts(token);

                sendResponse({ success: true, teamsWithPrompts });
            }
            catch (err)
            {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true; // keep channel open for async
    }

    if (message.type === "LOG_EVENT")
    {
        sendGAEvent(message.name, message.params);
    }

});


// =================================================================================================
// API
// =================================================================================================

export const api =
{
    fetchTeamsWithPrompts: (token) =>
    {
        const response = apiFetch("/prompts/getUserPrompts", { method: "GET", token });
        return response;
    },

    fetchTeams: (token) =>  
    {
        const response = apiFetch("/teams", { method: "GET", token });
        return response;
    },
}

async function apiFetch(endpoint, options)
{
    const { token, headers, ...rest } = options;

    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const config = {
        headers: {
            "Content-Type": "application/json",
            ...authHeaders,
            ...headers,
        },
        ...rest,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok)
    {
        let errorData;
        try
        {
            errorData = await response.json();
        }
        catch (jsonError)
        {
            errorData =
            {
                message: (jsonError instanceof Error ? jsonError.message : String(jsonError)) || response.statusText,
                statusCode: response.status,
            };
        }
        throw new Error(errorData.message || `API error: ${response.status}`);
    }
    if (response.status === 204)
    {
        return null;
    }

    const responseJson = await response.json();
    return responseJson;
}

// =================================================================================================
// Auth
// =================================================================================================

async function getExtensionTokenCookie()
{
    return new Promise((resolve) =>
    {
        console.log('Getting cookie in getExtensionTokenCookie using URL:', API_BASE_URL)
        chrome.cookies.get({ url: API_BASE_URL, name: "vostraExtensionToken", },
            (cookie) => { resolve(cookie ? cookie.value : null); }
        );
    });
}

// Signs in the user
async function ensureAuthenticated()
{
    if (auth.currentUser) return auth.currentUser;
    const extensionToken = await getExtensionTokenCookie();

    if (!extensionToken)
    {
        console.log("No extension cookie found, user likely not logged in via frontend");
        return null;
    }

    if (signingIn)
    {
        // wait until current sign-in finishes
        return new Promise((resolve) =>
        {
            const unsub = onAuthStateChanged(auth, (user) =>
            {
                if (user)
                {
                    unsub();
                    resolve(user);
                }
            });
        });
    }

    signingIn = true;
    try
    {
        console.log("Extension token is ", extensionToken)

        const userCredential = await signInWithCustomToken(auth, extensionToken);
        console.log("✅ Signed in with cookie:", userCredential.user.uid);

        lastSuccessfulToken = extensionToken;
        chrome.storage.local.set({ lastSuccessfulToken }); // persist

        sendGAEvent("login", { method: "cookie" });

        return userCredential.user;

    }
    catch (err)
    {
        console.error("❌ Sign-in failed:", err.code || err.message);

        // Retry once if it's likely a transient error
        if (err.code === "auth/network-request-failed")
        {
            console.log("Network error, retrying once...");
            try
            {
                const retryCred = await signInWithCustomToken(auth, extensionToken);
                console.log("✅ Signed in on retry:", retryCred.user.uid);
                return retryCred.user;
            } catch (retryErr)
            {
                console.error("Retry failed:", retryErr.code || retryErr.message);
            }
        }

        // Permanent failure → clear cookie and notify content script
        await chrome.cookies.remove({ url: API_BASE_URL, name: "vostraExtensionToken" });
        chrome.runtime.sendMessage({ type: "AUTH_ERROR", error: "Sign-in failed. Please log in again." });
        return null;
    }
    finally
    {
        signingIn = false;
    }
}

// Keep track of session
onAuthStateChanged(auth, (user) =>
{
    if (user)
    {
        console.log("Extension is authenticated:", user.uid);
        chrome.storage.local.set({ authStatus: { loggedIn: true, uid: user.uid } });
        lastSuccessfulToken = null;
    }
    else
    {
        console.log("Extension signed out");
        chrome.storage.local.set({ authStatus: { loggedIn: false } });
    }
});

// ======================================================================
// EXTENSION LIFECYCLE
// ======================================================================

chrome.runtime.onStartup.addListener(async () =>
{
    console.log("Extension starting, checking for cookie...");

    const tryAuth = async () =>
    {
        const cookieToken = await getExtensionTokenCookie();
        if (cookieToken)
        {
            lastToken = cookieToken;
            const user = await ensureAuthenticated();
            if (user) return true;
        }

        // Fallback to lastSuccessfulToken in storage
        const { lastSuccessfulToken } = await new Promise(resolve =>
        {
            chrome.storage.local.get("lastSuccessfulToken", resolve);
        });

        if (lastSuccessfulToken)
        {
            console.log("Using last successful token as fallback");
            lastToken = lastSuccessfulToken;
            const user = await ensureAuthenticated();
            if (user) return true;
        }

        return false; // failed auth
    };

    const authSucceeded = await new Promise(resolve =>
    {
        let resolved = false;
        const timeout = setTimeout(() =>
        {
            if (!resolved)
            {
                console.warn("Auth timeout — marking as needsAuth");
                chrome.storage.local.set({ authStatus: { loggedIn: false } });
                resolve(false);
            }
        }, 5000);

        tryAuth().then(success =>
        {
            resolved = true;
            clearTimeout(timeout);
            if (!success)
            {
                chrome.storage.local.set({ authStatus: { loggedIn: false } });
            }
            resolve(success);
        });
    });

    console.log("Startup auth result:", authSucceeded);
});

chrome.runtime.onInstalled.addListener(async (details) =>
{
    const extensionToken = await getExtensionTokenCookie();

    if (details.reason === "install")
    {
        if (!extensionToken)
        {
            console.log("First-time install and no token — opening login page...");
            chrome.tabs.create({ url: `${FRONTEND_URL}/login?fromExtension=true` });
        } else
        {
            console.log("First-time install but user already has a token — skipping login page.");
        }
    }

    // Always attempt sign-in if token exists
    if (extensionToken)
    {
        await ensureAuthenticated();
    }

    if (details.reason === "install")
    {
        sendGAEvent("extension_install");
    }
    else if (details.reason === "update")
    {
        sendGAEvent("extension_update", { previous_version: details.previousVersion });
    }
});

