import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

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

chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) =>
{
    if (message.type === "ID_TOKEN")
    {
        const refreshToken = message.extensionToken;
        try
        {
            console.log('Id token received', refreshToken)

            const userCredential = await signInWithCustomToken(auth, refreshToken);
            console.log("Extension signed in as:", userCredential.user.uid);

            // Optionally store token in chrome.storage
            chrome.storage.local.set({ uid: userCredential.user.uid });

            sendResponse({ success: true });
        }
        catch (err)
        {
            console.error("Sign-in failed in extension:", err);
            sendResponse({ success: false, error: err.message });
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{

    if (message.type === "GET_TEAMS")
    {
        (async function ()
        {
            try
            {
                const user = auth.currentUser;
                if (!user) throw new Error("Not signed in");

                const token = await user.getIdToken(true);
                console.log(token)

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
                const user = auth.currentUser;
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
    const API_BASE_URL = "http://localhost:3010"

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
            console.log("Error", errorData)
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

// Keep track of session
onAuthStateChanged(auth, (user) =>
{
    if (user)
    {
        console.log("Extension is authenticated:", user.uid);
    }
    else
    {
        console.log("Extension signed out");
    }
});

// Example: make sure extension can respond
chrome.runtime.onInstalled.addListener(() =>
{
    console.log("Background service worker installed");
});