import { LockClosedIcon, QrcodeIcon } from '@heroicons/react/solid';
import { LoginMethod } from '../types/LoginMethod';
import { classNames } from '../../../components/content/shared/filters/inventoryFunctions';

interface TabProps {
  name: string;
  icon: any;
  key: LoginMethod;
}

const tabs: TabProps[] = [
  { name: 'QR', icon: QrcodeIcon, key: 'QR' },
  { name: 'Regular', icon: LockClosedIcon, key: 'REGULAR' },
];

type LoginTabsProps = {
  selectedTab: LoginMethod;
  setSelectedTab: (tab: LoginMethod) => void;
};

export default function LoginTabs({
  selectedTab,
  setSelectedTab,
}: LoginTabsProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 pt-6 dark:border-gray-700 dark:bg-dark-level-one sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">
            Select a tab
          </label>
            <select
              id="tabs"
              name="tabs"
              className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-base text-gray-900 shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-dark-level-three dark:text-dark-white sm:text-sm"
              value={tabs.find((tab) => tab.key === selectedTab)?.name}
              onChange={e => {
                const selectedName = e.target.value;
                const selectedTabObj = tabs.find(tab => tab.name === selectedName);
                if (selectedTabObj) {
                  setSelectedTab(selectedTabObj.key);
                }
              }}
            >
              {tabs.map((tab) => (
                <option key={tab.name} value={tab.name}>{tab.name}</option>
              ))}
            </select>
        </div>
        <div className="hidden sm:block">
          <nav className="flex place-content-center">
            <ul
              role="list"
              className="flex  flex-none gap-x-6 px-2 text-sm font-semibold leading-6 text-gray-400"
            >
              {tabs.map((tab) => (
                <li key={tab.name}>
                  <button
                      onClick={() => setSelectedTab(tab.key)} className={classNames(tab.key === selectedTab ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : '', 'flex px-3 py-1 pointer place-content-center h-full items-center rounded-md')}>
                    <tab.icon className={classNames(tab.key === selectedTab ? 'text-green-700 dark:text-green-300' : "text-gray-400", 'h-6 w-6 pr-2')}/>
                    <span
                      className={
                        tab.key === selectedTab ? 'text-green-800 dark:text-green-300' : 'text-gray-400'
                      }
                    >
                      {tab.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
