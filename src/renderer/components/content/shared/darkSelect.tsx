import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import { Fragment } from 'react';

type SelectOption = {
  value: string;
  label: string;
};

type DarkSelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
};

export default function DarkSelect({
  value,
  options,
  onChange,
  className = '',
}: DarkSelectProps) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`relative ${className}`}>
        <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-white py-1.5 pl-2 pr-8 text-left text-sm text-gray-900 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-dark-level-one dark:text-dark-white">
          <span className="block truncate">{selected?.label || value}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <SelectorIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-50 mt-1 max-h-60 min-w-full w-max overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg focus:outline-none dark:border-gray-600 dark:bg-dark-level-three">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option.value}
                className={({ active }) => `relative cursor-pointer select-none py-2 pl-8 pr-2 ${active ? 'bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-200' : 'text-gray-900 dark:text-dark-white'}`}
              >
                {({ selected: isSelected }) => (
                  <>
                    <span className={`block whitespace-nowrap ${isSelected ? 'font-medium' : 'font-normal'}`}>{option.label}</span>
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-green-600 dark:text-green-400">
                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
