import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { siteConfigs } from "./siteConfigs";
import { PuffLoader } from "react-spinners";
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';

const host = window.location.hostname;
const config = siteConfigs[host];

const FRONTEND_URL = import.meta.env.VITE_ENVIRONMENT === "dev" ? "http://localhost:3000" : "https://app.getvostra.com";

function VostraButton({ config })
{
    const hasFetched = useRef(false);
    const [selectedInstructionSet, setSelectedInstructionSet] = useState(null);
    const [teamsWithInstructionSets, setTeamsWithInstructionSets] = useState([]);
    const [isLoadingInstructionSets, setIsLoadingInstructionSets] = useState(true);
    const [errorAuthenticatingUser, setErrorAuthenticatingUser] = useState(null);
    const [errorLoadingInstructionSets, setErrorLoadingInstructionSets] = useState(null);

    const fetchInstructionSets = () =>
    {
        // Step 1: Check if auth ready
        chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (authResponse) =>
        {
            if (!authResponse?.success)
            {
                setIsLoadingInstructionSets(false);
                setErrorAuthenticatingUser("Please sign in to Vostra")

                return;
            }

            setIsLoadingInstructionSets(true);

            // Step 2a: Try local cache first
            chrome.storage.local.get("teamsWithInstructionSets", (result) =>
            {
                if (result.teamsWithInstructionSets)
                {
                    setTeamsWithInstructionSets(result.teamsWithInstructionSets);
                    setErrorLoadingInstructionSets(null);
                    setIsLoadingInstructionSets(false); // immediate render, no flicker
                }
            });

            // Step 2: Now safe to fetch instruction sets
            chrome.runtime.sendMessage({ type: "GET_INSTRUCTION_SETS" }, (response) =>
            {
                if (response?.success)
                {
                    setTeamsWithInstructionSets(response.teamsWithInstructionSets);
                    setErrorLoadingInstructionSets(null);

                    chrome.storage.local.set({
                        teamsWithInstructionSets: response.teamsWithInstructionSets,
                    });
                }
                else
                {
                    setErrorLoadingInstructionSets("Failed to load instruction sets")
                }

                setIsLoadingInstructionSets(false);
            });
        });
    }

    useEffect(() =>
    {
        let isMounted = true;
        if (!hasFetched.current)
        {
            hasFetched.current = true;
            fetchInstructionSets(isMounted);
        }

        return () => { isMounted = false; };

    }, []);

    // Listen for auth state changes from background.js
    useEffect(() =>
    {
        const handleAuthChange = (changes, areaName) =>
        {
            if (areaName === "local" && changes.authStatus)
            {
                const newStatus = changes.authStatus.newValue;

                if (!newStatus.loggedIn)
                {
                    setErrorAuthenticatingUser("Please sign in to Vostra");
                }
                else
                {
                    setErrorAuthenticatingUser(null);
                    fetchInstructionSets();
                }
            }
        };

        chrome.storage.onChanged.addListener(handleAuthChange);

        return () =>
        {
            chrome.storage.onChanged.removeListener(handleAuthChange);
        };

    }, []);

    const instructionSetClicked = (teamIndex, instructionSetIndex) =>
    {
        const instructionSet = teamsWithInstructionSets[teamIndex].contexts[instructionSetIndex]
        setSelectedInstructionSet(instructionSet)

        const textDiv = document.querySelector('#prompt-textarea.ProseMirror');

        if (textDiv)
        {
            textDiv.focus();
            textDiv.textContent = instructionSet.content;

            // Manually trigger an 'input' event to activate the button
            const inputEvent = new Event('input', { bubbles: true });
            textDiv.dispatchEvent(inputEvent);

            const interval = setInterval(() =>
            {
                const submitButton = document.getElementById('composer-submit-button');
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
                disabled={isLoadingInstructionSets} >

                {config.llm === "gemini" && <span className="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>}

                <svg width="22" height="22" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g mask="url(#mask0_33_152)">
                        <path d="M448.689 460.745C410.475 498.158 349.651 497.962 311.659 459.858L310.604 458.797L355.42 412.639L356.477 413.7C369.985 427.247 391.739 427.103 405.069 413.375L487.546 328.431C500.873 314.703 500.727 292.593 487.22 279.045L403.626 195.203C390.118 181.655 368.361 181.8 355.034 195.526L272.557 280.472C259.665 293.749 259.381 314.866 271.599 328.495L226.762 374.673C190.061 336.475 189.496 275.644 225.376 236.769L227.133 234.914L309.611 149.968C347.692 110.75 409.847 110.336 448.442 149.045L532.036 232.887C570.631 271.596 571.048 334.77 532.97 373.987L450.49 458.934L448.689 460.745Z" fill="#065F46" />
                        <path d="M137.914 143.212C176.128 105.799 236.953 105.995 274.945 144.099L279.222 148.389L234.403 194.547L230.127 190.257C216.619 176.709 194.864 176.853 181.536 190.58L99.0573 275.526C85.7295 289.253 85.8755 311.363 99.3839 324.912L182.978 408.754C196.486 422.301 218.241 422.157 231.569 408.429L314.046 323.485C327.376 309.758 327.23 287.647 313.72 274.099L313.021 273.397L357.839 227.239L358.539 227.941C396.531 266.045 397.529 327.856 361.227 367.187L359.47 369.041L276.993 453.988C238.912 493.207 176.755 493.621 138.161 454.912L54.5668 371.07C15.9719 332.361 15.5543 269.187 53.6341 229.968L136.112 145.022L137.914 143.212Z" fill="#44403C" />
                    </g>
                </svg>


                <span className={config.textWrapperClass}>
                    {errorAuthenticatingUser ? "Sign in to Vostra"
                        :
                        isLoadingInstructionSets ? "Loading Vostra"
                            :
                            selectedInstructionSet ? selectedInstructionSet.title
                                :
                                "Select an instruction set from Vostra"
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

                    {errorAuthenticatingUser &&

                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>Vostra brings reusable instruction sets right to {config.llm == "chatgpt" ? "ChatGPT" : "Gemini"} </span>
                                <a style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }} href={`${FRONTEND_URL}/login`} target='_blank'>
                                    Sign in
                                </a>
                            </div>
                        </MenuItem>

                    }

                    {!errorAuthenticatingUser && isLoadingInstructionSets && (

                        <MenuItem>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                                <PuffLoader
                                    color={"#78716c"}
                                    size={50}
                                />
                            </div>
                        </MenuItem>

                    )}

                    {!errorAuthenticatingUser && errorLoadingInstructionSets && (
                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>{errorLoadingInstructionSets}</span>
                                <span
                                    style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }}
                                    onClick={() =>
                                    {
                                        setIsLoadingInstructionSets(true);
                                        setErrorLoadingInstructionSets(null);
                                        fetchInstructionSets();
                                    }}>
                                    Retry
                                </span>
                            </div>
                        </MenuItem>
                    )}

                    {!errorAuthenticatingUser && !isLoadingInstructionSets && !errorLoadingInstructionSets && teamsWithInstructionSets.length === 0 && (
                        <MenuItem>
                            <div className={config.menuTitleClass} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px' }}>
                                <span>No instruction sets available</span>
                                <span
                                    style={{ marginTop: '8px', color: '#065f46', cursor: 'pointer', fontWeight: '700' }}
                                    onClick={() =>
                                    {
                                        setIsLoadingInstructionSets(true);
                                        setErrorLoadingInstructionSets(null);
                                        fetchInstructionSets();
                                    }}>
                                    Create one in Vostra
                                </span>
                            </div>
                        </MenuItem>
                    )}

                    {!errorAuthenticatingUser && !isLoadingInstructionSets && !errorLoadingInstructionSets && teamsWithInstructionSets.length > 0 && (

                        <>
                            {teamsWithInstructionSets.map((team, teamIndex) => (

                                <>
                                    <span className={config.menuTitleClass} style={config.menuTitleStyle}>
                                        {team.name}
                                    </span>

                                    {team.contexts.map((instructionSet, instructionSetIndex) => (

                                        <MenuItem key={instructionSet.id}>
                                            <a onClick={() => instructionSetClicked(teamIndex, instructionSetIndex)} className={config.menuItemClass} style={config.menuItemStyle}>
                                                <span className={config.menuItemContentClass}>
                                                    {instructionSet.title}
                                                </span>
                                            </a>
                                        </MenuItem>
                                    ))}

                                </>
                            ))}

                            {config.llm === "chatgpt" && (
                                <div className="mx-4 my-1 bg-token-border-default h-px"></div>
                            )}

                            {config.llm === "gemini" && (
                                <hr className='mat-divider share-divider mat-divider-horizontal' />
                            )}


                            <MenuItem>
                                <a href="https://app.getvostra.com" target='_blank' className={config.menuItemClass} data-has-submenu>
                                    {config.menuIcons.instructionSets()}
                                    <span className={config.menuItemContentClass}>
                                        Manage instruction sets
                                    </span>

                                    {config.llm === "chatgpt" && (
                                        <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
                                    )}

                                </a>
                            </MenuItem>

                            <MenuItem>
                                <a href="https://app.getvostra.com/teams" target='_blank' className={config.menuItemClass} data-has-submenu>
                                    {config.menuIcons.manageTeams()}
                                    <span className={config.menuItemContentClass}>
                                        Manage teams
                                    </span>

                                    {config.llm === "chatgpt" && (
                                        <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
                                    )}

                                </a>
                            </MenuItem>

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
    const targetElement = document.querySelector(config.targetSelector);

    console.log(targetElement)

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
        const target = document.querySelector(config.targetSelector);

        if (!target) return; // No mount point yet

        // If the button is gone, mount it
        if (!document.querySelector("#vostra-button"))
        {
            mountReactComponent(config);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
else    
{
    console.log("Vostra: no site config for", host);
}
