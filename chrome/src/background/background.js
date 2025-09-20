import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

const FRONTEND_URL = import.meta.env.VITE_ENVIRONMENT === "dev" ? "http://localhost:3000" : "https://app.getvostra.com";
const API_BASE_URL = import.meta.env.VITE_ENVIRONMENT === "dev" ? "http://localhost:3010" : "https://ponte-ai.uc.r.appspot.com/"

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


// ======================================================================
// AUTO SIGN-IN WHEN COOKIE CHANGES
// ======================================================================

chrome.cookies.onChanged.addListener(async ({ cookie, removed }) =>
{
    if (cookie.name !== "vostraExtensionToken") return;

    if (!removed)
    {
        if (cookie.value === lastToken || signingIn)
        {
            console.log("Same token or already signing in, ignoring...");
            return;
        }

        console.log("New token detected, signing in via ensureAuthenticated...");
        lastToken = cookie.value;
        await ensureAuthenticated();
    }
    else
    {
        console.log("Token cookie removed — Firebase will sign out naturally");
    }
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

    if (message.type === "GET_INSTRUCTION_SETS")
    {
        (async function ()
        {
            try
            {
                const user = await ensureAuthenticated();
                if (!user) throw new Error("Not signed in");

                const token = await user.getIdToken(true);
                const teamsWithInstructionSets = await api.fetchTeamsWithInstructionSets(token);

                sendResponse({ success: true, teamsWithInstructionSets });
            }
            catch (err)
            {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true; // keep channel open for async
    }

});

// =================================================================================================
// API
// =================================================================================================

export const api =
{
    fetchTeamsWithInstructionSets: (token) =>
    {
        return apiFetch("/context/getUserContexts", { method: "GET", token });
    },

    fetchTeams: (token) =>
    {
        return apiFetch("/teams", { method: "GET", token });
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
        chrome.cookies.get({ url: FRONTEND_URL, name: "vostraExtensionToken", },
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
        console.warn("No extension cookie found, user likely not logged in via frontend");
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
        const userCredential = await signInWithCustomToken(auth, extensionToken);
        console.log("Signed in with cookie:", userCredential.user.uid);
        return userCredential.user;
    }
    catch (err)
    {
        console.error("Sign-in failed with cookie:", err);
        chrome.cookies.remove({
            url: FRONTEND_URL.startsWith("http") ? FRONTEND_URL : `https://${FRONTEND_URL}`,
            name: "vostraExtensionToken",
        });
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
    const extensionToken = await getExtensionTokenCookie();
    if (extensionToken)
    {
        await ensureAuthenticated();
    }
});

chrome.runtime.onInstalled.addListener(async () =>
{
    console.log("Extension installed, checking for cookie...");
    const extensionToken = await getExtensionTokenCookie();
    if (extensionToken)
    {
        await ensureAuthenticated();
    }
});
