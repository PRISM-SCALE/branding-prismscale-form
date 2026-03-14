import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ColorInput } from './components/ColorInput';
import { Section } from './components/Section';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ status: string; s3_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/generate-branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate branding page');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">Branding Page Generator</h1>
          <p className="text-lg text-gray-600">Upload assets and generate a client branding page in seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Brand Info */}
          <Section title="Brand Information" defaultOpen={true}>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={formData.brand_name || ''}
                  onChange={(e) => handleInputChange('brand_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Acme Corp"
                  required
                />
              </div>
              <FileUpload
                label="Brand Logo URL"
                fieldKey="brand_logo_url"
                onUploadComplete={handleInputChange}
                currentUrl={formData.brand_logo_url}
              />
              <FileUpload
                label="Brand Hero Image URL"
                fieldKey="brand_hero_image_url"
                onUploadComplete={handleInputChange}
                currentUrl={formData.brand_hero_image_url}
              />
            </div>
          </Section>

          {/* About */}
          <Section title="About Section">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About Client</label>
              <textarea
                value={formData.about_client_about || ''}
                onChange={(e) => handleInputChange('about_client_about', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe the client..."
              />
            </div>
          </Section>

          {/* Collaterals */}
          <Section title="Collaterals">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload label="Download All Collaterals (Zip)" fieldKey="collaterals_download_all_collaterals" onUploadComplete={handleInputChange} currentUrl={formData.collaterals_download_all_collaterals} accept=".zip,.rar,.7z" />
              <FileUpload label="Business Card" fieldKey="collaterals_businesscard_download_link" onUploadComplete={handleInputChange} currentUrl={formData.collaterals_businesscard_download_link} />
              <FileUpload label="Letterhead" fieldKey="collaterals_letterhead_download_link" onUploadComplete={handleInputChange} currentUrl={formData.collaterals_letterhead_download_link} />
              <FileUpload label="Email Signature" fieldKey="collaterals_emailsignature_download_link" onUploadComplete={handleInputChange} currentUrl={formData.collaterals_emailsignature_download_link} />
              <FileUpload label="Proposal" fieldKey="collaterals_proposal_link" onUploadComplete={handleInputChange} currentUrl={formData.collaterals_proposal_link} />
            </div>
          </Section>

          {/* Colors */}
          <Section title="Colors">
            <FileUpload label="Download Color Palette (PDF/ASE)" fieldKey="colors_download_link" onUploadComplete={handleInputChange} currentUrl={formData.colors_download_link} />
            
            <h3 className="text-md font-medium text-gray-900 mt-6 mb-4">Primary Colors</h3>
            <ColorInput label="Primary Color 1" prefix="colors_primary_1" values={formData} onChange={handleInputChange} />
            <ColorInput label="Primary Color 2" prefix="colors_primary_2" values={formData} onChange={handleInputChange} />

            <h3 className="text-md font-medium text-gray-900 mt-6 mb-4">Secondary Colors</h3>
            <ColorInput label="Secondary Color 1" prefix="colors_secondary_1" values={formData} onChange={handleInputChange} />
            <ColorInput label="Secondary Color 2" prefix="colors_secondary_2" values={formData} onChange={handleInputChange} />
            <ColorInput label="Secondary Color 3" prefix="colors_secondary_3" values={formData} onChange={handleInputChange} />
            <ColorInput label="Secondary Color 4" prefix="colors_secondary_4" values={formData} onChange={handleInputChange} />
          </Section>

          {/* Guidelines */}
          <Section title="Guidelines">
            <FileUpload label="Brand Guidelines PDF" fieldKey="guidelines_download_link" onUploadComplete={handleInputChange} currentUrl={formData.guidelines_download_link} accept=".pdf" />
          </Section>

          {/* Illustrations */}
          <Section title="Illustrations">
            <FileUpload label="Download All Illustrations" fieldKey="illustrations_download_link" onUploadComplete={handleInputChange} currentUrl={formData.illustrations_download_link} accept=".zip" />
            <FileUpload label="Hero Illustration" fieldKey="illustrations_hero_download_link" onUploadComplete={handleInputChange} currentUrl={formData.illustrations_hero_download_link} />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <FileUpload 
                  key={num}
                  label={`Tile ${num}`} 
                  fieldKey={`illustrations_tile_download_link_${num}`} 
                  onUploadComplete={handleInputChange} 
                  currentUrl={formData[`illustrations_tile_download_link_${num}`]} 
                />
              ))}
            </div>
          </Section>

          {/* Images */}
          <Section title="Images">
            <FileUpload label="Download All Images" fieldKey="images_download_link" onUploadComplete={handleInputChange} currentUrl={formData.images_download_link} accept=".zip" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <FileUpload 
                  key={num}
                  label={`Tile ${num}`} 
                  fieldKey={`images_tile_download_link_${num}`} 
                  onUploadComplete={handleInputChange} 
                  currentUrl={formData[`images_tile_download_link_${num}`]} 
                />
              ))}
            </div>
          </Section>

          {/* Logos */}
          <Section title="Logos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <FileUpload label="Download All Logos" fieldKey="logo_download_all_logos" onUploadComplete={handleInputChange} currentUrl={formData.logo_download_all_logos} accept=".zip" />
              <FileUpload label="Download All Secondary Logos" fieldKey="logo_download_all_logos_secondary" onUploadComplete={handleInputChange} currentUrl={formData.logo_download_all_logos_secondary} accept=".zip" />
            </div>
            
            <div className="grid grid-cols-1 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name (for Logo)</label>
                <input
                  type="text"
                  value={formData.logo_client_name || ''}
                  onChange={(e) => handleInputChange('logo_client_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Description</label>
                <textarea
                  value={formData.logo_logo_description || ''}
                  onChange={(e) => handleInputChange('logo_logo_description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload label="Vertical Logo" fieldKey="logo_vertical_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_vertical_download_link} />
              <FileUpload label="Horizontal Logo" fieldKey="logo_horizontal_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_horizontal_download_link} />
              <FileUpload label="Dark Variant" fieldKey="logo_variant_dark_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_variant_dark_download_link} />
              <FileUpload label="Mono Black" fieldKey="logo_variant_mono_black_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_variant_mono_black_download_link} />
              <FileUpload label="Mono White" fieldKey="logo_variant_mono_white_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_variant_mono_white_download_link} />
              
              <h4 className="col-span-full text-sm font-semibold text-gray-900 mt-4">Favicons</h4>
              <FileUpload label="Favicon Light" fieldKey="logo_favicon_light_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_favicon_light_download_link} />
              <FileUpload label="Favicon Dark" fieldKey="logo_favicon_dark_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_favicon_dark_download_link} />
              <FileUpload label="Favicon Mono White" fieldKey="logo_favicon_mono_white_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_favicon_mono_white_download_link} />
              <FileUpload label="Favicon Mono Black" fieldKey="logo_favicon_mono_black_download_link" onUploadComplete={handleInputChange} currentUrl={formData.logo_favicon_mono_black_download_link} />
            </div>
          </Section>

          {/* Patterns */}
          <Section title="Patterns">
            <FileUpload label="Download All Patterns" fieldKey="patterns_download_link" onUploadComplete={handleInputChange} currentUrl={formData.patterns_download_link} accept=".zip" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <FileUpload label="Large Pattern 1" fieldKey="patterns_large_download_link_1" onUploadComplete={handleInputChange} currentUrl={formData.patterns_large_download_link_1} />
              <FileUpload label="Large Pattern 2" fieldKey="patterns_large_download_link_2" onUploadComplete={handleInputChange} currentUrl={formData.patterns_large_download_link_2} />
              <FileUpload label="Small Pattern 1" fieldKey="patterns_small_download_link_1" onUploadComplete={handleInputChange} currentUrl={formData.patterns_small_download_link_1} />
              <FileUpload label="Small Pattern 2" fieldKey="patterns_small_download_link_2" onUploadComplete={handleInputChange} currentUrl={formData.patterns_small_download_link_2} />
              <FileUpload label="Small Pattern 3" fieldKey="patterns_small_download_link_3" onUploadComplete={handleInputChange} currentUrl={formData.patterns_small_download_link_3} />
              <FileUpload label="Small Pattern 4" fieldKey="patterns_small_download_link_4" onUploadComplete={handleInputChange} currentUrl={formData.patterns_small_download_link_4} />
            </div>
          </Section>

          {/* Typography */}
          <Section title="Typography">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Font Name</label>
                <input
                  type="text"
                  value={formData.typography_primary_font_name || ''}
                  onChange={(e) => handleInputChange('typography_primary_font_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Inter"
                />
              </div>
              <FileUpload label="Download Fonts (Zip)" fieldKey="typography_download_fonts" onUploadComplete={handleInputChange} currentUrl={formData.typography_download_fonts} accept=".zip" />
            </div>
          </Section>

          {/* Submit Action */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg flex justify-end items-center gap-4 z-50">
            {error && (
              <div className="flex items-center text-red-600 text-sm mr-auto">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={generating}
              className={`flex items-center gap-2 px-8 py-3 rounded-lg text-white font-semibold text-lg shadow-md transition-all
                ${generating 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:transform active:scale-95'
                }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Branding Page'
              )}
            </button>
          </div>
        </form>

        {/* Success Modal */}
        {result && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-600 mb-6">Your branding page has been generated successfully.</p>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 break-all">
                <a href={result.s3_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">
                  {result.s3_url}
                </a>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setResult(null)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Close
                </button>
                <a
                  href={result.s3_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 font-medium"
                >
                  Open Page
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </div>
      {/* Spacer for fixed footer */}
      <div className="h-20" />
    </div>
  );
}
