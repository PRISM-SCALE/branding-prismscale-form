import React from 'react';

interface ColorInputProps {
  label: string;
  prefix: string; // e.g., "colors_primary_1"
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function ColorInput({ label, prefix, values, onChange }: ColorInputProps) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 mb-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{label}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={values[`${prefix}_name`] || ''}
            onChange={(e) => onChange(`${prefix}_name`, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Midnight Blue"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hex</label>
          <div className="flex items-center">
            <div 
              className="w-8 h-8 rounded-l-md border border-r-0 border-gray-300"
              style={{ backgroundColor: values[`${prefix}_hex`] || '#ffffff' }}
            />
            <input
              type="text"
              value={values[`${prefix}_hex`] || ''}
              onChange={(e) => onChange(`${prefix}_hex`, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">CMYK</label>
          <input
            type="text"
            value={values[`${prefix}_cmyk`] || ''}
            onChange={(e) => onChange(`${prefix}_cmyk`, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0, 0, 0, 100"
          />
        </div>
      </div>
    </div>
  );
}
