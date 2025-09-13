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

                <svg width="22" height="22" viewBox="0 0 256 182" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-300">
                    <path d="M188.056 156.06C173.137 170.623 149.706 171.063 134.265 157.276L152.488 138.563C157.947 142.474 165.551 141.924 170.4 136.945L203.783 102.665C209.177 97.1257 209.118 88.203 203.651 82.7357L169.817 48.9016C164.349 43.4344 155.544 43.4928 150.15 49.032L116.767 83.3118C112.306 87.8927 111.576 94.7871 114.549 100.128L96.1627 119.008C83.3905 103.538 83.8579 80.598 97.6714 65.6755L98.3826 64.927L131.765 30.6472C147.178 14.8206 172.335 14.6538 187.956 30.2747L221.79 64.1088C237.411 79.7297 237.58 105.223 222.168 121.05L188.785 155.33L188.056 156.06Z" fill="#065F46" />
                    <path d="M62.324 27.8591C77.1811 13.3564 100.48 12.8604 115.923 26.4729L97.6793 45.2068C92.2367 41.4605 84.766 42.0594 79.9797 46.9744L46.5972 81.2541C41.2029 86.7935 41.262 95.7162 46.7293 101.183L80.5634 135.018C86.0307 140.485 94.8359 140.426 100.23 134.887L133.613 100.607C138.139 95.9598 138.824 88.9311 135.699 83.5592L154.052 64.7133C166.992 80.1855 166.581 103.257 152.709 118.244L151.998 118.992L118.615 153.272C103.203 169.099 78.0449 169.265 62.424 153.645L28.5899 119.81L12.9689 104.189 12.8 78.6961 28.2124 62.8693L61.5949 28.5896L62.324 27.8591Z" fill="#292524" />
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
