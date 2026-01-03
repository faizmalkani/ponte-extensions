import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth/web-extension";

const IS_DEV = "false"
const FRONTEND_URL = IS_DEV ? "http://localhost:3000" : "https://app.getvostra.com";
const API_BASE_URL = IS_DEV ? "http://localhost:3010/v1" : "https://ponte-ai.uc.r.appspot.com/v1";

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

const mockResponse = [
    {
        "id": "kMi6ooOJT1m6rb87EiPc",
        "name": "Faiz' Personal Workspace",
        "isOwner": true,
        "prompts": [
            {
                "id": "kbBSltViSLQU3Zg85cov",
                "createdBy": "RGHVoD71pMQI7mBq6ibLEa8ivR73",
                "createdAt": "2025-08-04T10:40:30.931Z",
                "title": "Account Research Before a Call",
                "description": "Detailed deep-dive of client research",
                "content": "You are an expert User Feedback Analyst...",
                "updatedAt": "2025-12-26T10:38:31.051Z"
            }
        ]
    },
    {
        "id": "ThCssX7RwSmHAPjGgLmk",
        "name": "Marketing Team",
        "isOwner": true,
        "prompts": []
    },
    {
        "id": "vX92ppL0ZqR3tYm1nB5v",
        "name": "Customer Success",
        "isOwner": false,
        "prompts": [
            {
                "id": "prm_001",
                "title": "Onboarding Email Generator",
                "description": "Drafts personalized welcome sequences",
                "content": "Generate a 3-part email sequence for a new SaaS user..."
            },
            {
                "id": "prm_002",
                "title": "Churn Risk Analysis",
                "description": "Analyzes usage patterns for risk",
                "content": "Based on the following login data, predict churn probability..."
            },
            {
                "id": "prm_003",
                "title": "Renewal Reminder",
                "description": "Friendly nudge for upcoming billing",
                "content": "Write a polite reminder that the subscription expires in 7 days..."
            }
        ]
    },
    {
        "id": "aB29kkM91pQO4vR7iLp2",
        "name": "Engineering Operations",
        "isOwner": true,
        "prompts": [
            {
                "id": "eng_01",
                "title": "PR Description Generator",
                "description": "Automates GitHub PR summaries",
                "content": "Summarize the following git diff into a bulleted list..."
            },
            {
                "id": "eng_02",
                "title": "Legacy Code Explainer",
                "description": "Explains COBOL or old Java blocks",
                "content": "Explain what this function does in plain English..."
            },
            {
                "id": "eng_03",
                "title": "Unit Test Boilerplate",
                "description": "Creates Jest tests for functions",
                "content": "Write 5 edge-case unit tests for the following Javascript function..."
            },
            {
                "id": "eng_04",
                "title": "SQL Query Optimizer",
                "description": "Refactors slow queries",
                "content": "Analyze this SQL query for performance bottlenecks..."
            },
            {
                "id": "eng_05",
                "title": "Documentation Draft",
                "description": "Creates JSDoc comments",
                "content": "Add JSDoc comments to all exported functions in this file..."
            },
            {
                "id": "eng_06",
                "title": "Security Vulnerability Scan",
                "description": "Checks code for OWASP risks",
                "content": "Review the following code for common security flaws..."
            }
        ]
    },
    {
        "id": "zY11qqW22eR33tT44yY5",
        "name": "Product Management",
        "isOwner": false,
        "prompts": [
            {
                "id": "pm_001",
                "title": "User Story Creator",
                "description": "Formats requirements into Gherkin",
                "content": "Given a user wants to export data, write the AC..."
            },
            {
                "id": "pm_002",
                "title": "Roadmap Prioritization",
                "description": "RICE scoring assistant",
                "content": "Calculate the RICE score for these 5 features..."
            }
        ]
    },
    {
        "id": "mL99ooP00iI11uU22bB3",
        "name": "Sales Enablement",
        "isOwner": true,
        "prompts": [
            { "id": "s_1", "title": "Objection Handling", "content": "The prospect says it is too expensive. Suggest 3 rebuttals..." },
            { "id": "s_2", "title": "Cold Outreach", "content": "Write a short LinkedIn DM for a CTO..." },
            { "id": "s_3", "title": "Discovery Questions", "content": "List 10 questions for a fintech lead..." },
            { "id": "s_4", "title": "Competitor Comparison", "content": "Compare our pricing to Competitor X..." },
            { "id": "s_5", "title": "Call Summary", "content": "Extract action items from this transcript..." },
            { "id": "s_6", "title": "Follow-up Strategy", "content": "How should I follow up after a ghosted demo?..." },
            { "id": "s_7", "title": "ROI Calculator Explanation", "content": "Explain how we save users $5k/mo..." },
            { "id": "s_8", "title": "Pitch Deck Script", "content": "Write a script for slide 4 (Data Security)..." },
            { "id": "s_9", "title": "Referral Request", "content": "Ask a happy client for a warm intro..." },
            { "id": "s_10", "title": "Case Study Outline", "content": "Draft a case study structure for a retail client..." },
            { "id": "s_11", "title": "Demo Agenda", "content": "Create a 30-minute demo flow..." },
            { "id": "s_12", "title": "Contract FAQ", "content": "Answer questions about our SLA..." },
            { "id": "s_13", "title": "Discount Approval Hook", "content": "Draft an internal note to the VP of Sales..." },
            { "id": "s_14", "title": "Territory Research", "content": "Find the top 5 companies in EMEA for..." },
            { "id": "s_15", "title": "Win/Loss Analysis", "content": "Why did we lose the Acme Corp deal?..." },
            { "id": "s_16", "title": "LinkedIn Post Draft", "content": "Write a post about industry trends..." },
            { "id": "s_17", "title": "Event Follow-up", "content": "Template for people I met at the conference..." },
            { "id": "s_18", "title": "Value Prop Refinement", "content": "Simplify our mission statement for a CEO..." },
            { "id": "s_19", "title": "Trial Extension Email", "content": "Offer 7 more days of the pro plan..." },
            { "id": "s_20", "title": "Quarterly Review Deck", "content": "Summarize my sales performance for Q3..." }
        ]
    },
    {
        "id": "hH77gG66fF55dD44sS33",
        "name": "Legal & Compliance",
        "isOwner": false,
        "prompts": [
            {
                "id": "leg_1",
                "title": "GDPR Clause Checker",
                "description": "Reviews contracts for data privacy",
                "content": "Check if this contract complies with Article 28..."
            }
        ]
    },
    {
        "id": "xX11cC22vV33bB44nN55",
        "name": "Executive Leadership",
        "isOwner": true,
        "prompts": []
    }
]

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

});

// =================================================================================================
// API
// =================================================================================================

export const api =
{
    fetchTeamsWithPrompts: (token) =>
    {
        const response = IS_DEV ? mockResponse : apiFetch("/prompts/getUserPrompts", { method: "GET", token });
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
        console.log('Getting cookie in getExtensionTokenCookie')
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
        console.log("Extension token is ", extensionToken)

        const userCredential = await signInWithCustomToken(auth, extensionToken);
        console.log("✅ Signed in with cookie:", userCredential.user.uid);

        lastSuccessfulToken = extensionToken;
        chrome.storage.local.set({ lastSuccessfulToken }); // persist
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
});
