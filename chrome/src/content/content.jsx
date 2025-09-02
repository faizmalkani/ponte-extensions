import React, { useState, useEffect, useRef } from 'react';

import ReactDOM from 'react-dom/client';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';


function VostraButton()
{
    const hasFetched = useRef(false);
    const [selectedInstructionSet, setSelectedInstructionSet] = useState(null);
    const [teamsWithInstructionSets, setTeamsWithInstructionSets] = useState([]);
    const [isLoadingInstructionSets, setIsLoadingInstructionSets] = useState(true);

    useEffect(() =>
    {
        if (hasFetched.current)
        {
            setIsLoadingInstructionSets(false);
            return;
        }
        hasFetched.current = true;

        chrome.runtime.sendMessage({ type: "GET_INSTRUCTION_SETS" }, (response) =>
        {
            if (response?.success)
            {
                setTeamsWithInstructionSets(response.teamsWithInstructionSets);
                setIsLoadingInstructionSets(false);
            }
            else
            {
                console.error(response?.error);
            }
        });

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

            const submitButton = document.getElementById('composer-submit-button');
            if (submitButton)
            {
                submitButton.click();
            }
        }
    }

    return (

        <Menu>

            <MenuButton className="flex items-center gap-2 text-token-text-primary btn btn-ghost">

                <svg width="22" height="22" viewBox="0 0 256 182" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-300">
                    <path d="M188.056 156.06C173.137 170.623 149.706 171.063 134.265 157.276L152.488 138.563C157.947 142.474 165.551 141.924 170.4 136.945L203.783 102.665C209.177 97.1257 209.118 88.203 203.651 82.7357L169.817 48.9016C164.349 43.4344 155.544 43.4928 150.15 49.032L116.767 83.3118C112.306 87.8927 111.576 94.7871 114.549 100.128L96.1627 119.008C83.3905 103.538 83.8579 80.598 97.6714 65.6755L98.3826 64.927L131.765 30.6472C147.178 14.8206 172.335 14.6538 187.956 30.2747L221.79 64.1088C237.411 79.7297 237.58 105.223 222.168 121.05L188.785 155.33L188.056 156.06Z" fill="#065F46" />
                    <path d="M62.324 27.8591C77.1811 13.3564 100.48 12.8604 115.923 26.4729L97.6793 45.2068C92.2367 41.4605 84.766 42.0594 79.9797 46.9744L46.5972 81.2541C41.2029 86.7935 41.262 95.7162 46.7293 101.183L80.5634 135.018C86.0307 140.485 94.8359 140.426 100.23 134.887L133.613 100.607C138.139 95.9598 138.824 88.9311 135.699 83.5592L154.052 64.7133C166.992 80.1855 166.581 103.257 152.709 118.244L151.998 118.992L118.615 153.272C103.203 169.099 78.0449 169.265 62.424 153.645L28.5899 119.81L12.9689 104.189 12.8 78.6961 28.2124 62.8693L61.5949 28.5896L62.324 27.8591Z" fill="#292524" />
                </svg>

                <span className="ml-1">
                    {isLoadingInstructionSets
                        ? "Initializing Vostra"
                        : selectedInstructionSet
                            ? selectedInstructionSet.title
                            : "Select an instruction set from Vostra"
                    }
                </span>

            </MenuButton>


            <MenuItems anchor="bottom end" className="z-50 bg-token-main-surface-primary dark:bg-[#353535] shadow-long rounded-2xl outline-0 focus-visible:outline-0 focus:outline-0 min-w-[calc(var(--sidebar-width)-12px)] max-w-xs overflow-y-auto select-none popover">
                <div className="shadow-lg py-1.5">
                    {isLoadingInstructionSets ? (

                        <MenuItem>
                            <a href="#" className="gap-1.5 __menu-item">
                                Loading...
                            </a>
                        </MenuItem>


                    ) : (

                        <>
                            {teamsWithInstructionSets.map((team, teamIndex) => (

                                <>
                                    <span className='__menu-label'>{team.name}</span>

                                    {team.contexts.map((instructionSet, instructionSetIndex) => (

                                        <MenuItem key={instructionSet.id}>
                                            <a onClick={() => instructionSetClicked(teamIndex, instructionSetIndex)} className="gap-1.5 __menu-item">
                                                {instructionSet.title}
                                            </a>
                                        </MenuItem>
                                    ))}

                                </>
                            ))}

                            <div className="mx-4 my-1 bg-token-border-default h-px"></div>

                            <MenuItem>
                                <a href="#" className="group flex flex-row items-center __menu-item" data-has-submenu>
                                    <div className='flex items-center gap-1.5'>
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon" aria-hidden="true"><path d="M12.0303 4.11328C13.4406 2.70317 15.7275 2.70305 17.1377 4.11328C18.5474 5.52355 18.5476 7.81056 17.1377 9.2207L10.8457 15.5117C10.522 15.8354 10.2868 16.0723 10.0547 16.2627L9.82031 16.4394C9.61539 16.5794 9.39783 16.7003 9.1709 16.7998L8.94141 16.8916C8.75976 16.9582 8.57206 17.0072 8.35547 17.0518L7.59082 17.1865L5.19727 17.5859C5.05455 17.6097 4.90286 17.6358 4.77441 17.6455C4.67576 17.653 4.54196 17.6555 4.39648 17.6201L4.24707 17.5703C4.02415 17.4746 3.84119 17.3068 3.72559 17.0957L3.67969 17.0029C3.59322 16.8013 3.59553 16.6073 3.60547 16.4756C3.61519 16.3473 3.6403 16.1963 3.66406 16.0537L4.06348 13.6602C4.1638 13.0582 4.22517 12.6732 4.3584 12.3096L4.45117 12.0791C4.55073 11.8521 4.67152 11.6346 4.81152 11.4297L4.9873 11.1953C5.17772 10.9632 5.4146 10.728 5.73828 10.4043L12.0303 4.11328ZM6.67871 11.3447C6.32926 11.6942 6.14542 11.8803 6.01953 12.0332L5.90918 12.1797C5.81574 12.3165 5.73539 12.4618 5.66895 12.6133L5.60742 12.7666C5.52668 12.9869 5.48332 13.229 5.375 13.8789L4.97656 16.2725L4.97559 16.2744H4.97852L7.37207 15.875L8.08887 15.749C8.25765 15.7147 8.37336 15.6839 8.4834 15.6435L8.63672 15.581C8.78817 15.5146 8.93356 15.4342 9.07031 15.3408L9.2168 15.2305C9.36965 15.1046 9.55583 14.9207 9.90527 14.5713L14.8926 9.583L11.666 6.35742L6.67871 11.3447ZM16.1963 5.05371C15.3054 4.16303 13.8616 4.16305 12.9707 5.05371L12.6074 5.41601L15.833 8.64257L16.1963 8.27929C17.0869 7.38844 17.0869 5.94455 16.1963 5.05371Z"></path><path d="M5.13477 6.68139L5 6.6687H2.5C2.13273 6.6687 1.83496 6.96647 1.83496 7.33374C1.83518 7.70082 2.13286 7.99877 2.5 7.99877H5L5.13477 7.9851C5.4375 7.92299 5.66485 7.6548 5.66504 7.33374C5.66504 7.01249 5.43764 6.74352 5.13477 6.68139Z"></path><path d="M8.46777 3.34838L8.33301 3.33471H2.5C2.13281 3.33471 1.8351 3.6326 1.83496 3.99975C1.83496 4.36702 2.13273 4.66479 2.5 4.66479H8.33301L8.46777 4.65112C8.77057 4.58893 8.99805 4.32094 8.99805 3.99975C8.99793 3.67864 8.77054 3.41052 8.46777 3.34838Z"></path></svg>
                                        Manage instruction sets
                                    </div>
                                    <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
                                </a>
                            </MenuItem>

                            <MenuItem>
                                <a href="#" className="group flex flex-row items-center __menu-item" data-has-submenu>
                                    <div className='flex items-center gap-1.5'>
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon" aria-hidden="true"><path d="M10.3227 1.62663C11.1514 1.62663 11.9182 2.066 12.3373 2.78092L13.1586 4.18131L13.2123 4.25065C13.2735 4.31105 13.3565 4.34658 13.4448 4.34733L15.06 4.36002L15.2143 4.36686C15.9825 4.4239 16.6774 4.85747 17.0649 5.53092L17.393 6.10221L17.4662 6.23795C17.7814 6.88041 17.7842 7.63306 17.4741 8.27799L17.4028 8.41373L16.6 9.83561C16.5426 9.93768 16.5425 10.0627 16.6 10.1647L17.4028 11.5856L17.4741 11.7223C17.7841 12.3673 17.7815 13.1199 17.4662 13.7624L17.393 13.8981L17.0649 14.4694C16.6774 15.1427 15.9824 15.5764 15.2143 15.6335L15.06 15.6393L13.4448 15.653C13.3565 15.6537 13.2736 15.6892 13.2123 15.7497L13.1586 15.818L12.3373 17.2194C11.9182 17.9342 11.1513 18.3737 10.3227 18.3737H9.6762C8.8995 18.3735 8.17705 17.9874 7.74456 17.3503L7.66253 17.2194L6.84124 15.818C6.79652 15.7418 6.72408 15.6876 6.64105 15.6647L6.55511 15.653L4.93987 15.6393C4.16288 15.633 3.44339 15.2413 3.01605 14.6003L2.93499 14.4694L2.60687 13.8981C2.19555 13.1831 2.1916 12.3039 2.5971 11.5856L3.39886 10.1647L3.43206 10.0846C3.44649 10.0293 3.44644 9.97102 3.43206 9.91569L3.39886 9.83561L2.5971 8.41373C2.19175 7.6955 2.19562 6.8171 2.60687 6.10221L2.93499 5.53092L3.01605 5.40006C3.44337 4.75894 4.1628 4.36636 4.93987 4.36002L6.55511 4.34733L6.64105 4.33561C6.72418 4.31275 6.79651 4.25762 6.84124 4.18131L7.66253 2.78092L7.74456 2.65006C8.17704 2.01277 8.89941 1.62678 9.6762 1.62663H10.3227ZM9.6762 2.9567C9.36439 2.95685 9.07299 3.10138 8.88421 3.34342L8.80999 3.45377L7.9887 4.85416C7.72933 5.29669 7.28288 5.59093 6.78265 5.6608L6.56585 5.67741L4.95062 5.6901C4.63868 5.69265 4.34845 5.84001 4.16155 6.08366L4.08733 6.19401L3.75921 6.7653C3.58227 7.073 3.5808 7.45131 3.7553 7.76041L4.55706 9.18131L4.65179 9.37663C4.81309 9.77605 4.81294 10.2232 4.65179 10.6227L4.55706 10.819L3.7553 12.2399C3.58083 12.549 3.5822 12.9273 3.75921 13.235L4.08733 13.8053L4.16155 13.9157C4.34844 14.1596 4.6385 14.3067 4.95062 14.3092L6.56585 14.3229L6.78265 14.3385C7.28292 14.4084 7.72931 14.7036 7.9887 15.1462L8.80999 16.5465L8.88421 16.6559C9.07298 16.8982 9.36422 17.0435 9.6762 17.0436H10.3227C10.6793 17.0436 11.0095 16.8542 11.1899 16.5465L12.0112 15.1462L12.1332 14.9655C12.4432 14.5668 12.9212 14.3271 13.434 14.3229L15.0492 14.3092L15.1811 14.2995C15.4854 14.2567 15.7569 14.076 15.9125 13.8053L16.2407 13.235L16.2983 13.1169C16.3983 12.8745 16.3999 12.6023 16.3022 12.359L16.2446 12.2399L15.4418 10.819C15.1551 10.311 15.1551 9.6893 15.4418 9.18131L16.2446 7.76041L16.3022 7.64127C16.4 7.39806 16.3982 7.12584 16.2983 6.88346L16.2407 6.7653L15.9125 6.19401C15.7568 5.92338 15.4855 5.74264 15.1811 5.69987L15.0492 5.6901L13.434 5.67741C12.9212 5.67322 12.4432 5.43341 12.1332 5.03483L12.0112 4.85416L11.1899 3.45377C11.0095 3.14604 10.6794 2.9567 10.3227 2.9567H9.6762ZM11.5854 9.99967C11.5852 9.12461 10.8755 8.41497 10.0004 8.41471C9.12516 8.41471 8.41466 9.12445 8.41448 9.99967C8.41448 10.875 9.12505 11.5846 10.0004 11.5846C10.8756 11.5844 11.5854 10.8749 11.5854 9.99967ZM12.9145 9.99967C12.9145 11.6094 11.6101 12.9145 10.0004 12.9147C8.39051 12.9147 7.08538 11.6096 7.08538 9.99967C7.08556 8.38991 8.39062 7.08463 10.0004 7.08463C11.61 7.08489 12.9143 8.39007 12.9145 9.99967Z"></path></svg>
                                        Manage teams
                                    </div>
                                    <svg className='opacity-0 group-hover:opacity-100 ml-auto icon-sm' width="16" height="16" viewBox="0 0 16 16" fill="#8f8f8f" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M11.3349 10.3301V5.60547L4.47065 12.4707C4.21095 12.7304 3.78895 12.7304 3.52925 12.4707C3.26955 12.211 3.26955 11.789 3.52925 11.5293L10.3945 4.66504H5.66011C5.29284 4.66504 4.99507 4.36727 4.99507 4C4.99507 3.63273 5.29284 3.33496 5.66011 3.33496H11.9999L12.1337 3.34863C12.4369 3.41057 12.665 3.67857 12.665 4V10.3301C12.6649 10.6973 12.3672 10.9951 11.9999 10.9951C11.6327 10.9951 11.335 10.6973 11.3349 10.3301ZM11.333 4.66699L11.3349 4.66797L11.332 4.66504H11.331L11.333 4.66699Z"></path></svg>
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
function mountReactComponent()
{
    const targetElement = document.querySelector('#conversation-header-actions');
    const existingRoot = document.getElementById('vostra-root');

    if (existingRoot)
    {
        // If the element already exists, we're done.
        return;
    }

    if (targetElement)
    {
        const rootContainer = document.createElement('div');
        rootContainer.id = 'vostra-root';
        targetElement.prepend(rootContainer);

        const root = ReactDOM.createRoot(rootContainer);
        root.render(<VostraButton />);
    }
    else
    {
        console.error('Target element not found.');
    }
}

const observer = new MutationObserver((mutations, obs) =>
{
    const targetElement = document.querySelector('#conversation-header-actions');
    if (targetElement)
    {
        mountReactComponent();
        obs.disconnect(); // Stop observing once the component is mounted
    }
});

observer.observe(document.body, { childList: true, subtree: true, });
