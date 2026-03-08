import React, { useEffect, useState } from 'react';

interface ColorInputProps {
  label: string;
  prefix: string; // e.g., "colors_primary_1"
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const normalizeHex = (raw: string) => {
  if (!raw) return '';
  let v = raw.trim();
  if (!v) return '';
  if (!v.startsWith('#')) v = `#${v}`;
  // Expand shorthand #abc -> #aabbcc
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    return v.toLowerCase();
  }
  // return the best-effort value (could be invalid)
  return v;
};

export function ColorInput({ label, prefix, values, onChange }: ColorInputProps) {
  const hexKey = `${prefix}_hex`;
  const nameKey = `${prefix}_name`;
  const cmykKey = `${prefix}_cmyk`;

  const initialHex = values[hexKey] || '';
  const [hexInput, setHexInput] = useState(initialHex);
  const [colorValue, setColorValue] = useState(() => {
    const n = normalizeHex(initialHex);
    return n && /^#[0-9a-fA-F]{6}$/.test(n) ? n : '#ffffff';
  });

  // Sync local state when parent values change
  useEffect(() => {
    const v = values[hexKey] || '';
    if (v !== hexInput) {
      setHexInput(v);
      const n = normalizeHex(v);
      if (/^#[0-9a-fA-F]{6}$/.test(n)) setColorValue(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values[hexKey]]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHexInput(e.target.value);
  };

  const handleHexBlur = () => {
    const n = normalizeHex(hexInput);
    setHexInput(n);
    if (/^#[0-9a-fA-F]{6}$/.test(n)) {
      setColorValue(n);
      onChange(hexKey, n);
    } else {
      // still propagate the normalized value (could be empty or invalid) so parent keeps consistent
      onChange(hexKey, n);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; // always a valid #rrggbb
    setColorValue(v);
    setHexInput(v);
    onChange(hexKey, v);
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 mb-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">{label}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={values[nameKey] || ''}
            onChange={(e) => onChange(nameKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Midnight Blue"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hex</label>
          <div className="flex items-center">
            <input
              type="color"
              value={colorValue}
              onChange={handleColorChange}
              className="w-10 h-10 rounded-l-md border border-r-0 border-gray-300 p-0"
              aria-label={`${label} color picker`}
            />
            <input
              type="text"
              value={hexInput}
              onChange={handleHexChange}
              onBlur={handleHexBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">CMYK</label>
          <input
            type="text"
            value={values[cmykKey] || ''}
            onChange={(e) => onChange(cmykKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0, 0, 0, 100"
          />
        </div>
      </div>
    </div>
  );
}