import { CheckIcon, DocumentDownloadIcon, TrashIcon, UserIcon } from '@heroicons/react/solid';
import { useEffect, useState } from 'react';
import { classNames } from '../../../renderer/components/content/shared/filters/inventoryFunctions';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createCSGOImage } from '../../functionsClasses/createCSGOImage';

export default function UserGrid({ clickOnProfile, deleteUser,  runDeleteUser }) {
  const [getUsers, setUsers] = useState([] as any);
  const [exportingReport, setExportingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');

  // The brain
  async function updateFunction() {
    let finalList = [] as any;
    let seenValues = [] as any

    // Get the account details
    let doUpdate = await window.electron.ipcRenderer.getAccountDetails();
    if (doUpdate == undefined) {
      doUpdate = {};
    }

    // Get the order of the account details
    let valueToUse = [] as any;
    await window.electron.store.get('accountKeyList').then((returnValue) => {
      valueToUse = returnValue
    });

    // Conditional logic
    if (valueToUse != undefined) {
      valueToUse.forEach(element => {
        if (seenValues.includes(element) == false) {
          seenValues.push(element)
        }
      });
      for (const [key, value] of Object.entries(doUpdate)) {
        let userObject = value as any;
        userObject['username'] = key;
        if (!seenValues.includes(userObject['username'])) {
          finalList.push(userObject);
        }
      }
      seenValues.reverse()
      seenValues.forEach(element => {
        if (doUpdate[element] != undefined) {
          let userObject = doUpdate[element] as any;
          userObject['username'] = element;
          finalList.splice(0, 0, userObject)
        }

      });
    } else {
      for (const [key, value] of Object.entries(doUpdate)) {
        let userObject = value as any;
        userObject['username'] = key;
        finalList.push(userObject);
      }
    }
    // Apply the account details
    setUsers(finalList)

  }
  useEffect(() => {
    let isMounted = true;

    async function loadProfiles() {
      await updateFunction();

      try {
        // This fills metadata that was absent in sessions saved by older builds.
        await window.electron.ipcRenderer.refreshSavedProfileDetails();
        if (isMounted) {
          await updateFunction();
        }
      } catch (error) {
        console.warn('Unable to refresh saved Steam profiles', error);
      }
    }

    void loadProfiles();
    return () => {
      isMounted = false;
    };
  }, []);

  // Remove account
  async function removeUsername(username) {
    window.electron.ipcRenderer.deleteAccountDetails(username);
    updateFunction();
  }

  async function exportAllProfiles() {
    setExportingReport(true);
    setReportMessage('Loading saved profile inventories…');
    try {
      const result = await window.electron.ipcRenderer.exportSavedProfileInventoryReport();
      const skipped = result.failedProfiles?.length || 0;
      const storageWarnings = result.storageWarnings?.length || 0;
      const priceEmpireSummary = result.priceEmpireWarning
        ? ` ${result.priceEmpireWarning}`
        : ` Compared with ${result.priceEmpirePortfolioCount} PriceEmpire portfolio${result.priceEmpirePortfolioCount === 1 ? '' : 's'}${result.excludedPriceEmpirePortfolioCount ? `; ${result.excludedPriceEmpirePortfolioCount} excluded` : ''}.`;
      setReportMessage(
        `Excel report created: ${result.itemRows} item type${result.itemRows === 1 ? '' : 's'} from ${result.exportedProfiles.length} profile${result.exportedProfiles.length === 1 ? '' : 's'}${skipped ? `; ${skipped} profile${skipped === 1 ? '' : 's'} skipped` : ''}${storageWarnings ? `; ${storageWarnings} Storage Unit${storageWarnings === 1 ? '' : 's'} skipped` : ''}.${priceEmpireSummary}`,
      );
    } catch (error: any) {
      setReportMessage(error?.message || 'Could not create the Excel report.');
    } finally {
      setExportingReport(false);
    }
  }
  if (deleteUser) {
    updateFunction()
    runDeleteUser()
  }

  // Drag n drop features
  async function handleOnDragEnd(result) {
    // Check if actually moved
    if (!result.destination) return;
    const items = Array.from(getUsers);

    // Store change locally and in the settings
    window.electron.ipcRenderer.setAccountPosition(result.draggableId, result.destination.index)
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setUsers(items);

    // Storex for next session
    const orderToStore = [] as any;
    items.forEach(element => {
      let e = element as any
      orderToStore.push(e.username)

    });
    await window.electron.store.set('accountKeyList', orderToStore)

  }

  return (
    <div className="overflow-x-auto border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-dark-level-two lg:h-screen-fixed lg:border-b-0">
      <div className="grid grid-cols-1 gap-3 px-4 py-6 overflow-y-auto">
        <div className="px-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-white">Saved Steam profiles</h2>
            <button
              type="button"
              disabled={exportingReport || getUsers.length === 0}
              onClick={exportAllProfiles}
              title="Create one Excel report from every saved profile"
              className={classNames(
                exportingReport || getUsers.length === 0
                  ? 'cursor-not-allowed bg-gray-300 dark:bg-gray-700'
                  : 'bg-green-600 hover:bg-green-700',
                'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
              )}
            >
              <DocumentDownloadIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {exportingReport ? 'Exporting…' : 'Export all to Excel'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Click the green button to enter a saved session.</p>
          {reportMessage && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{reportMessage}</p>}
        </div>
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="characters">
            {(provided) => (
              <ul className="characters" {...provided.droppableProps} ref={provided.innerRef}>
                {getUsers.length == 0 ? (
                  <li
                    className={classNames(
                      'relative rounded-lg border border-gray-300 border-dashed dark:bg-dark-level-four bg-white px-6 py-5 flex items-center space-x-3 focus-within:ring-2 focus-within:ring-green-500'
                    )}
                  >
                    <div className="shrink-0">
                      <svg
                        className="w-10 h-10 rounded-full shrink-0 text-gray-300"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-white">
                        Nothing here
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Login to add user
                      </p>
                    </div>
                  </li>
                ) : (
                  getUsers.map((person, index) => (
                    <Draggable
                      key={person.username}
                      draggableId={person.username}
                      index={index}
                    >
                      {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={classNames(
                          index == 0 ? '' : 'mt-5',
                          person.refreshToken ? 'border-green-300 dark:border-green-900' : 'border-gray-300 dark:border-gray-700',
                          'relative rounded-lg border dark:bg-dark-level-four bg-white px-4 py-4 shadow-sm flex items-center space-x-3 hover:border-green-400 focus-within:ring-2 focus-within:ring-green-500'
                        )}
                      >
                        <div className="shrink-0">
                          {person.imageURL ? (
                            <img
                              className="h-11 w-11 rounded-full border-2 border-green-500 object-cover"
                              src={person.imageURL}
                              alt={`${person.displayName || person.username} Steam avatar`}
                              onError={(event) => {
                                if (!event.currentTarget.dataset.fallbackApplied) {
                                  event.currentTarget.dataset.fallbackApplied = 'true';
                                  event.currentTarget.src = createCSGOImage('econ/characters/customplayer_tm_separatist');
                                }
                              }}
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              <UserIcon className="h-6 w-6" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-white">
                            {person.displayName || person.username}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {person.username}
                          </p>
                          <p className={classNames(person.refreshToken ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500', 'mt-1 text-xs')}>
                            {person.refreshToken ? 'Session saved' : 'Sign in again to save a session'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            clickOnProfile([
                              person.username,
                              Boolean(person.refreshToken),
                            ])
                          }
                          title={`Sign in as ${person.displayName || person.username}`}
                          className="inline-flex items-center rounded-full bg-green-600 p-2 text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUsername(person.username)}
                          className={classNames(
                            'inline-flex items-center p-1 border border-transparent rounded-full dark:text-dark-white hover:shadow-sm text-black hover:bg-gray-50 transition duration-500 ease-in-out hover:text-white hover:bg-red-600 transform hover:-translate-y-1 hover:scale-110'
                          )}
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </li>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
