import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { siteConfigs } from "./siteConfigs";

// Helper to check if the extension context is valid
const isExtensionValid = () =>
{
    try
    {
        return chrome.runtime && !!chrome.runtime.id;
    } catch (e)
    {
        return false;
    }
};
import { PuffLoader } from "react-spinners";
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';

const IS_DEV = import.meta.env.DEV;
const FRONTEND_URL = IS_DEV ? "http://localhost:3000" : "https://app.getvostra.com";

if (!IS_DEV)
{
    console.log = () => { };
}

const host = window.location.hostname.replace(/^www\./, "");
const config = siteConfigs[host];
console.log("Starting Vostra for", config.llm);


const logEvent = (name, params = {}) =>
{
    if (isExtensionValid())
    {
        try
        {
            chrome.runtime.sendMessage({ type: "LOG_EVENT", name, params: { ...params, llm: config?.llm } });
        } catch (e)
        {
            console.log("[Vostra Content] Failed to send LOG_EVENT message", e);
        }
    } else
    {
        console.log("[Vostra Content] Extension context invalid, cannot log event");
    }
};

let globalPromptsCache = null;

function VostraButton({ config })
{
    const hasFetched = useRef(false);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [teamsWithPrompts, setTeamsWithPrompts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredTeams = teamsWithPrompts.map(team => ({
        ...team,
        prompts: team.prompts.filter(p =>
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    })).filter(team => team.prompts.length > 0);

    const [status, setStatus] = useState({
        isLoading: true,
        error: null,
        needsAuth: false,
    });

    // Listen for AUTH_ERROR messages from background.js
    useEffect(() =>
    {
        if (!isExtensionValid()) return;

        const listener = (msg) =>
        {
            if (msg.type === "AUTH_ERROR")
            {
                console.log("Auth error from background:", msg.error);
                setStatus({
                    isLoading: false,
                    error: null,
                    needsAuth: true,
                });
                setTeamsWithPrompts([]);
            }
        };

        try
        {
            chrome.runtime.onMessage.addListener(listener);
        } catch (e)
        {
            console.log("Vostra: Could not add message listener", e);
        }

        return () =>
        {
            try
            {
                if (isExtensionValid())
                {
                    chrome.runtime.onMessage.removeListener(listener);
                }
            } catch (e)
            {
                // Ignore cleanup errors
            }
        };
    }, []);

    const fetchInstructionSets = (force = false) =>
    {
        if (!isExtensionValid())
        {
            return;
        }

        // 1. Check in-memory cache first (if not forcing)
        console.log(`Vostra: Fetch calls. Force: ${force}, Cache exits: ${!!globalPromptsCache}`);
        if (!force && globalPromptsCache)
        {
            console.log("Vostra: Using in-memory cache");
            setTeamsWithPrompts(globalPromptsCache);
            setStatus(prev => ({ ...prev, isLoading: false, error: null }));
            return;
        }

        setStatus(prevStatus => ({
            ...prevStatus,
            isLoading: true,
            error: null,
            needsAuth: false, // Assume authenticated until proven otherwise
        }));

        setTeamsWithPrompts([]);

        try
        {
            // Step 1: Check if auth ready
            chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (authResponse) =>
            {
                if (chrome.runtime.lastError)
                {
                    console.log("Vostra: Runtime error checking auth state", chrome.runtime.lastError);
                    return;
                }

                if (!authResponse?.success)
                {
                    setStatus({
                        isLoading: false,
                        error: null, // No generic error, but needs auth
                        needsAuth: true, // Specific state for sign-in required
                    });

                    return;
                }

                // Helper to perform the actual network fetch
                const fetchFromNetwork = () =>
                {
                    try
                    {
                        chrome.runtime.sendMessage({ type: "GET_PROMPTS" }, (response) =>
                        {
                            if (chrome.runtime.lastError)
                            {
                                console.log("Vostra: Runtime error fetching prompts", chrome.runtime.lastError);
                                setStatus(prevStatus => ({
                                    ...prevStatus,
                                    isLoading: false,
                                    error: "Extension disconnected"
                                }));
                                return;
                            }

                            if (response?.success)
                            {
                                console.log("Vostra: Loaded from Network");
                                setTeamsWithPrompts(response.teamsWithPrompts);
                                globalPromptsCache = response.teamsWithPrompts;
                                setStatus(prevStatus => ({ ...prevStatus, isLoading: false, error: null }));

                                console.log("Vostra: Saving to Local Storage");
                                chrome.storage.local.set({
                                    teamsWithPrompts: response.teamsWithPrompts,
                                });
                            }
                            else
                            {
                                const errorMessage = `Failed to load prompts: ${response?.message || 'Unknown error'}.`;

                                setStatus(prevStatus => ({
                                    ...prevStatus,
                                    isLoading: false,
                                    error: errorMessage
                                }));

                                console.log("Vostra: Failed to load prompts", JSON.stringify(response));
                            }
                        });
                    } catch (e)
                    {
                        console.log("Vostra: sendMessage failed", e);
                    }
                };

                // Step 2: Decide whether to load from cache or network
                // For Strategy C: "When whole page loads, fetch from network"
                // Since page load means globalPromptsCache is null, we just fall through to network.
                // We only use cache if it's in memory (SPA Switch).

                fetchFromNetwork();
            });
        } catch (e)
        {
            console.log("Vostra: Failed to start auth check", e);
            setStatus(prevStatus => ({
                ...prevStatus,
                isLoading: false,
                error: "Extension context invalidated"
            }));
        }
    }

    useEffect(() =>
    {
        let isMounted = true;
        if (!hasFetched.current)
        {
            hasFetched.current = true;
            fetchInstructionSets(false);
        }

        return () => { isMounted = false; };

    }, []);

    // Listen for auth state changes from background.js
    useEffect(() =>
    {
        if (!isExtensionValid()) return;

        const handleAuthChange = (changes, areaName) =>
        {
            if (areaName === "local" && changes.authStatus)
            {
                const newStatus = changes.authStatus.newValue;

                if (!newStatus.loggedIn)
                {
                    setStatus({
                        isLoading: false,
                        error: null,
                        needsAuth: true,
                    });
                    setTeamsWithPrompts([]);
                }
                else
                {
                    fetchInstructionSets();
                }
            }
        };

        try
        {
            chrome.storage.onChanged.addListener(handleAuthChange);
        } catch (e)
        {
            console.log("Vostra: Failed to add storage listener", e);
        }

        return () =>
        {
            try
            {
                if (isExtensionValid())
                {
                    chrome.storage.onChanged.removeListener(handleAuthChange);
                }
            } catch (e) { }
        };

    }, []);

    const promptClicked = (prompt) =>
    {
        logEvent("prompt_select", { prompt_id: prompt.id, prompt_title: prompt.title });
        setSelectedPrompt(prompt)

        let textDiv;
        if (config.llm === "gemini")
        {
            textDiv = document.querySelector('div[role="textbox"].ql-editor');
        }
        if (config.llm === "chatgpt")
        {
            textDiv = document.querySelector('#prompt-textarea.ProseMirror');
        }

        if (textDiv)
        {
            textDiv.focus();
            textDiv.textContent = prompt.content;

            // Manually trigger an 'input' event to activate the button
            const inputEvent = new Event('input', { bubbles: true });
            textDiv.dispatchEvent(inputEvent);

            const interval = setInterval(() =>
            {
                let submitButton;
                if (config.llm === "gemini")
                {
                    submitButton = document.querySelector('button.send-button.submit');
                }
                if (config.llm === "chatgpt")
                {
                    submitButton = document.getElementById('composer-submit-button');
                }

                if (submitButton)
                {
                    submitButton.click();
                    clearInterval(interval);
                }
            }, 50);
        }
    }

    return (

        <Menu>

            <MenuButton
                id="vostra-button"
                ref={(el) => config.applyRef && config.applyRef(el)}
                className={config.buttonClass}
                style={config.style}
                onClick={() => logEvent("vostra_menu_open")}
                disabled={status.isLoading} >

                {config.llm === "gemini" && <span className="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>}

                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.4519 17.8645C15.0507 19.2363 12.8205 19.2291 11.4275 17.832L11.3888 17.7931L13.0321 16.1006L13.0708 16.1395C13.5661 16.6363 14.3638 16.631 14.8525 16.1276L17.8767 13.013C18.3653 12.5096 18.36 11.6989 17.8647 11.2022L14.7996 8.12797C14.3043 7.63121 13.5066 7.63653 13.0179 8.13982L9.99374 11.2545C9.52104 11.7413 9.51062 12.5156 9.95862 13.0153L8.31459 14.7085C6.96889 13.3079 6.94817 11.0775 8.26377 9.65206L8.3282 9.58404L11.3524 6.46936C12.7487 5.03136 15.0277 5.01618 16.4429 6.43551L19.508 9.50972C20.9231 10.929 20.9384 13.2454 19.5422 14.6834L16.518 17.7981L16.4519 17.8645Z" fill="#065F46" />
                    <path d="M5.05721 6.22137C6.45839 4.84956 8.68864 4.85675 10.0817 6.25389L10.2385 6.41119L8.59514 8.10365L8.43835 7.94635C7.94306 7.44959 7.14538 7.45487 6.65668 7.9582L3.63246 11.0729C3.14378 11.5762 3.14913 12.3869 3.64444 12.8837L6.70956 15.9579C7.20485 16.4546 8.00253 16.4494 8.49123 15.946L11.5154 12.8314C12.0041 12.3281 11.9988 11.5173 11.5034 11.0206L11.4778 10.9948L13.1211 9.30236L13.1468 9.3281C14.5398 10.7252 14.5764 12.9916 13.2454 14.4338L13.1809 14.5018L10.1568 17.6165C8.76047 19.0545 6.48138 19.0697 5.06627 17.6504L2.00115 14.5762C0.586 13.1568 0.570688 10.8405 1.96695 9.40242L4.99114 6.28774L5.05721 6.22137Z" fill="#44403C" />
                </svg>


                <span className={config.textWrapperClass} style={config.textWrapperStyle}>
                    {
                        status.needsAuth ? "Sign in to Vostra"
                            : status.isLoading ? "Loading Vostra"
                                : status.error ? "Error loading Vostra, click to retry"
                                    : selectedPrompt ? selectedPrompt.title
                                        : "Select a prompt from Vostra"
                    }
                </span>

                {config.llm === "gemini" && (
                    <>
                        <span className="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
                        <span className="mat-focus-indicator"></span>
                        <span className="mat-mdc-button-touch-target"></span>
                        <span className="mat-ripple mat-mdc-button-ripple"></span>
                    </>
                )}

            </MenuButton>

            <MenuItems anchor="bottom end" className={config.menuClass} style={config.menuStyle}>

                <div className={config.menuContentClass} style={config.menuContentStyle}>


                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} >

                        <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', justifyContent: 'space-between', alignItems: 'center', margin: '8px 16px' }}>

                            <a href={FRONTEND_URL + "/teams"} target='_blank' >
                                <div>
                                    <svg width="32px" height="32px" viewBox="0 0 160 111" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M126.384 102.715C115.376 113.442 98.0885 113.766 86.6954 103.61L100.141 89.8268C104.169 92.7074 109.779 92.3027 113.357 88.635L137.988 63.3854C141.968 59.3052 141.924 52.733 137.89 48.7059L112.927 23.7845C108.893 19.7575 102.396 19.8005 98.4159 23.8806L73.7856 49.1302C70.4941 52.5044 69.9553 57.5826 72.1486 61.5166L58.583 75.4233C49.1594 64.0281 49.5043 47.1313 59.6962 36.1397L60.2209 35.5884L84.8512 10.3388C96.2229 -1.31872 114.785 -1.44158 126.31 10.0644L151.274 34.9857C162.799 46.4917 162.924 65.2696 151.552 76.9271L126.922 102.177L126.384 102.715Z" fill={`${config.llm === "gemini" ? "#727676" : "#d8d8d2ff"}`} />
                                        <path d="M33.6161 8.28507C44.578 -2.39724 61.7682 -2.76259 73.1625 7.26403L59.702 21.063C55.6863 18.3036 50.1742 18.7447 46.6428 22.3649L22.0125 47.6145C18.0324 51.6947 18.0761 58.2669 22.11 62.294L47.0735 87.2154C51.1074 91.2424 57.604 91.1994 61.5841 87.1194L86.2144 61.8698C89.5538 58.4464 90.0596 53.2693 87.7536 49.3124L101.295 35.431C110.843 46.8274 110.539 63.8215 100.304 74.8602L99.7791 75.4115L75.1488 100.661C63.7771 112.319 45.2153 112.441 33.6898 100.936L8.72633 76.0142C-2.79913 64.5082 -2.9238 45.7303 8.4478 34.0728L33.0781 8.82317L33.6161 8.28507Z" fill={`${config.llm === "gemini" ? "#727676" : "#d8d8d2ff"}`} />
                                    </svg>
                                </div>
                            </a>

                            <a onClick={(e) => { e.preventDefault(); logEvent("sync_library"); fetchInstructionSets(true); }} title="Sync library" className={config.menuItemClass} style={{ padding: '0px', cursor: 'pointer', width: 'fit-content' }}>
                                <span className={config.menuItemContentClass} style={{ padding: '0px !important', lineHeight: '0' }}>
                                    {config.menuIcons.reload()}
                                </span>
                            </a>

                        </div>

                        {!status.needsAuth && !status.isLoading && !status.error && (
                            <div style={config.llm === "gemini" ? { padding: '8px 12px', display: 'flex', marginBottom: '4px', borderRadius: '8px', justifyContent: 'stretch' } : { padding: '8px 16px', display: 'flex', marginBottom: '4px', justifyContent: 'stretch' }}>
                                <input
                                    type="text"
                                    placeholder="Search prompts..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                    {
                                        setSearchTerm(e.target.value);
                                        if (e.target.value.length === 3) logEvent("search_prompts", { term: e.target.value });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className={config.menuItemClass}
                                    style={config.searchItemStyle}
                                />
                            </div>
                        )}
                    </div>


                    {status.needsAuth &&

                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>Vostra brings reusable prompts right to {config.llm == "chatgpt" ? "ChatGPT" : "Gemini"} </span>
                                <a style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }} href={`${FRONTEND_URL}/login`} target='_blank'>
                                    Sign in
                                </a>
                            </div>
                        </MenuItem>

                    }

                    {!status.needsAuth && status.isLoading && (

                        <MenuItem>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                                <PuffLoader
                                    color={"#78716c"}
                                    size={50}
                                />
                            </div>
                        </MenuItem>

                    )}

                    {!status.needsAuth && status.error && (

                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>{status.error}</span>
                                <span
                                    style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }}
                                    onClick={() => fetchInstructionSets(true)}>
                                    Retry
                                </span>
                            </div>
                        </MenuItem>
                    )}

                    {!status.needsAuth && !status.isLoading && !status.error && teamsWithPrompts.length === 0 && (

                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>No prompts available</span>
                                <a
                                    style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }}
                                    href="https://app.getvostra.com" target='_blank'>
                                    Create one in Vostra
                                </a>
                            </div>
                        </MenuItem>
                    )}

                    {!status.needsAuth && !status.isLoading && !status.error && teamsWithPrompts.length > 0 && (

                        <>
                            {filteredTeams.length === 0 && searchTerm && (
                                <MenuItem>
                                    <div className={config.menuTitleClass} style={{ padding: '16px', opacity: 0.7 }}>
                                        No results for "{searchTerm}"
                                    </div>
                                </MenuItem>
                            )}

                            {filteredTeams.map((team, teamIndex) => (

                                <div key={teamIndex}>
                                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                        <span className={config.menuTitleClass} style={config.menuTitleStyle}>
                                            {team.name}
                                        </span>
                                        <span style={config.sharedTeamIndicatorStyle}>
                                            {team.isOwner ? '' : config.menuIcons.shared()}
                                        </span>
                                    </div>

                                    {team.prompts.length === 0 && (
                                        <MenuItem>
                                            <div className={config.menuItemClass} style={{ pointerEvents: 'none' }}>
                                                <span className={config.menuItemEmptyClass}>
                                                    No prompts in this team
                                                </span>
                                            </div>
                                        </MenuItem>
                                    )}

                                    {team.prompts.map((prompt, promptIndex) => (

                                        <MenuItem key={prompt.id}>
                                            <a onClick={() => promptClicked(prompt)} className={config.menuItemClass} style={config.menuItemStyle}>
                                                <span className={config.menuItemContentClass}>
                                                    {prompt.title}
                                                </span>
                                            </a>
                                        </MenuItem>
                                    ))}

                                    {config.llm === "chatgpt" && (
                                        <div role="separator" aria-orientation="horizontal" className="bg-token-border-default h-px mx-4 my-1"></div>
                                    )}


                                    {config.llm === "gemini" && (
                                        <hr className='mat-divider share-divider mat-divider-horizontal opacity-50' />
                                    )}

                                </div>
                            ))}





                            <MenuItem>
                                <a href={FRONTEND_URL} target='_blank' onClick={() => logEvent("manage_prompts_click")} className={config.menuItemClass} data-has-submenu>
                                    {config.menuIcons.prompts()}
                                    <span className={config.menuItemContentClass}>
                                        Manage prompts
                                    </span>

                                    {config.llm === "chatgpt" && (
                                        <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
                                    )}

                                </a>
                            </MenuItem>

                            {/* <MenuItem>
                                <a href={FRONTEND_URL + "/teams"} target='_blank' className={config.menuItemClass} data-has-submenu>
                                    config.menuIcons.manageTeams()
                                    <span className={config.menuItemContentClass}>
                                        Manage teams
                                    </span>

                                    {config.llm === "chatgpt" && (
                                        <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
                                    )}

                                </a>
                            </MenuItem> */}

                        </>
                    )}


                </div>
            </MenuItems>

        </Menu >

    );
}


// Function to find the target element and render the React component
function mountReactComponent(config)
{
    console.log("Vostra: Mounting React component for ", config.llm);
    const targetElement = document.querySelector(config.targetSelector);

    // Checks if there's no target or it already exists in the target
    if (!targetElement) return;
    if (document.getElementById("vostra-root")) return;

    const rootContainer = document.createElement("div");
    rootContainer.id = "vostra-root";

    if (config.insertPosition === "prepend")
    {
        targetElement.prepend(rootContainer);
    }
    else if (config.insertPosition === "append")
    {
        targetElement.append(rootContainer);
    }
    else if (config.insertPosition === "before")
    {
        targetElement.before(rootContainer);
    }
    else if (config.insertPosition === "after")
    {
        targetElement.after(rootContainer);
    }

    const root = ReactDOM.createRoot(rootContainer);
    root.render(<VostraButton config={config} />);
}

if (config)
{
    const observer = new MutationObserver(() =>
    {
        if (!isExtensionValid())
        {
            // Extension context invalidated, stop observing
            try { observer.disconnect(); } catch (e) { }
            return;
        }

        const target = document.querySelector(config.targetSelector);

        if (!target) return; // No mount point yet

        // If the button is gone, mount it
        if (!document.querySelector("#vostra-button"))
        {
            mountReactComponent(config);
        }
    });

    try
    {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    } catch (e)
    {
        console.log("Vostra: Failed to start observer", e);
    }
}
else    
{
    console.log("Vostra: no site config for", host);
}
