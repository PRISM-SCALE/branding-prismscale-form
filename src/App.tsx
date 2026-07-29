import React, { useState, useEffect, useRef } from "react";
import { FileUpload } from "./components/FileUpload";
import { ColorInput } from "./components/ColorInput";
import { Section } from "./components/Section";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { motion } from "motion/react";
import { HERO_SPEC, LOGO_SPEC } from "./lib/imageSpec";

type PlaceholderSection = Record<string, string>;

const SECTION_DEFINITIONS = [
  { id: "brand", title: "Brand Information" },
  { id: "about", title: "About Section" },
  { id: "logo", title: "Logo Design" },
  { id: "colors", title: "Color Palette" },
  { id: "typography", title: "Typography" },
  { id: "illustrations", title: "Illustrations" },
  { id: "images", title: "Images" },
  { id: "patterns", title: "Patterns" },
  { id: "collaterals", title: "Collaterals" },
  { id: "guidelines", title: "Brand Guidelines" },
];

const DEFAULT_SECTION_LABELS: Record<string, string> = {
  brand: "(01) Brand Information",
  about: "(02) About The Brand",
  logo: "(03) Logo Design",
  colors: "(04) Color Palette",
  typography: "(05) Typography",
  illustrations: "(06) Illustrations",
  images: "(07) Images",
  patterns: "(08) Patterns",
  collaterals: "(09) Collaterals",
  guidelines: "(10) Brand Guidelines",
};

const DEFAULT_SECTION_ORDER = SECTION_DEFINITIONS.map((section) => section.id);

const DEFAULT_SECTION_VISIBILITY = SECTION_DEFINITIONS.reduce<
  Record<string, boolean>
>((acc, section) => {
  acc[section.id] = true;
  return acc;
}, {});

const PLACEHOLDER_GRID_IMAGE_KEYS = Array.from(
  { length: 6 },
  (_, index) => `placeholder_grid_image_${index + 1}`,
);
const PLACEHOLDER_PDF_GROUPS = [
  {
    title: "placeholder_pdf_title_1",
    description: "placeholder_pdf_description_1",
    link: "placeholder_pdf_link_1",
  },
  {
    title: "placeholder_pdf_title_2",
    description: "placeholder_pdf_description_2",
    link: "placeholder_pdf_link_2",
  },
  {
    title: "placeholder_pdf_title_3",
    description: "placeholder_pdf_description_3",
    link: "placeholder_pdf_link_3",
  },
];

const REQUIRED_FIELDS = [
  { key: "brand_name", label: "Brand Name", section: "brand" },
  { key: "brand_logo_url", label: "Brand Logo", section: "brand" },
  { key: "brand_hero_image_url", label: "Brand Hero Image", section: "brand" },
  { key: "about_client_about", label: "About Client", section: "about" },
  {
    key: "logo_download_all_logos",
    label: "Download All Logos (Zip)",
    section: "logo",
  },
  {
    key: "logo_vertical_download_link",
    label: "Vertical Logo",
    section: "logo",
  },
] as const;

const REQUIRED_SECTIONS = new Set([
  "brand",
  "about",
  "typography",
  "logo",
  "colors",
]);

type ColorGroup = "primary" | "secondary" | "tertiary";

const COLOR_GROUPS: readonly ColorGroup[] = ["primary", "secondary", "tertiary"] as const;

const DEFAULT_COLOR_GROUP_LABELS: Record<ColorGroup, string> = {
  primary: "Primary Colors",
  secondary: "Secondary Colors",
  tertiary: "Tertiary Colors",
};

type DynamicTileSection = "illustrations" | "images";

const DEFAULT_DYNAMIC_TILE_LABEL: Record<DynamicTileSection, string> = {
  illustrations: "Illustration",
  images: "Image",
};

const DEFAULT_COLLATERAL_ITEMS: { id: string; label: string }[] = [
  { id: "businesscard", label: "Business Card" },
  { id: "letterhead", label: "Letterhead" },
  { id: "emailsignature", label: "Email Signature" },
];

// Matches lambda_function.py _sanitize_brand_name exactly
function sanitizeBrandName(name: string): string {
  return (
    name
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "brand"
  );
}

const S3_BRAND_BASE =
  "https://prismscales3.s3.amazonaws.com/branding-prismscale";

const DRAFT_KEY = "prismscale-branding-draft";

function deriveIndexedCount(
  data: Record<string, string> | undefined,
  keyPrefix: string,
): number {
  if (!data) return 1;
  const re = new RegExp(`^${keyPrefix}_(\\d+)_`);
  const nums = Object.keys(data)
    .map((k) => {
      const m = k.match(re);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  return nums.length > 0 ? Math.max(...nums) : 1;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const LEGACY_COLLATERAL_KEY_MAP: Record<string, string> = {
  collaterals_businesscard_download_link:
    "collaterals_item_businesscard_download_link",
  collaterals_letterhead_download_link:
    "collaterals_item_letterhead_download_link",
  collaterals_emailsignature_download_link:
    "collaterals_item_emailsignature_download_link",
};

function migrateFormData(
  source: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!source) return {};
  const data = { ...(source as Record<string, string>) };
  for (const [legacyKey, newKey] of Object.entries(LEGACY_COLLATERAL_KEY_MAP)) {
    if (data[legacyKey] && !data[newKey]) {
      data[newKey] = data[legacyKey];
    }
    delete data[legacyKey];
  }
  delete data.logo_client_name;
  delete data.logo_download_all_logos_secondary;
  delete data.illustrations_hero_download_link;
  return data;
}

function formatDraftTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} mins ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const createEmptyPlaceholder = (): PlaceholderSection => {
  const base: PlaceholderSection = {
    id: "",
    label: "",
    placeholder_title: "",
    placeholder_subtitle: "",
    placeholder_grid_heading: "",
    placeholder_status: "",
    placeholder_owner: "",
    placeholder_details: "",
    placeholder_cta_label: "",
    placeholder_cta_link: "",
    placeholder_progress: "",
    placeholder_progress_pct: "",
    placeholder_footnote: "",
  };

  PLACEHOLDER_GRID_IMAGE_KEYS.forEach((key) => {
    base[key] = "";
  });

  PLACEHOLDER_PDF_GROUPS.forEach((group) => {
    base[group.title] = "";
    base[group.description] = "";
    base[group.link] = "";
  });

  return base;
};

const placeholderHasContent = (section: PlaceholderSection) =>
  Object.values(section).some((value) => value?.trim().length > 0);

type TypographyFontCardProps = {
  type: "primary" | "secondary";
  i: number;
  formData: Record<string, string>;
  validationErrors: Record<string, string>;
  handleInputChange: (key: string, value: string) => void;
  removeFont: (type: "primary" | "secondary", idx: number) => void;
  clearValidationError?: (key: string) => void;
};

function TypographyFontCard({
  type,
  i,
  formData,
  validationErrors,
  handleInputChange,
  removeFont,
  clearValidationError,
}: TypographyFontCardProps) {
  const nameKey = `typography_${type}_${i}_name`;
  const fileKey = `typography_${type}_${i}_file`;
  const isFirst = i === 1;
  const errorKey = `typography_${type}_1_name`;

  return (
    <div
      id={isFirst ? `field-${errorKey}` : undefined}
      className="relative rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4"
    >
      {isFirst && validationErrors[errorKey] && (
        <p className="mb-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" /> {validationErrors[errorKey]}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Font Name {isFirst && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={formData[nameKey] || ""}
            onChange={(e) => {
              handleInputChange(nameKey, e.target.value);
              if (isFirst) clearValidationError?.(errorKey);
            }}
            placeholder={
              type === "primary" ? "e.g. Inter" : "e.g. Playfair Display"
            }
            className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              isFirst && validationErrors[errorKey]
                ? "border-red-400 ring-1 ring-red-300"
                : "border-gray-300"
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Font File
          </label>
          <FileUpload
            label=""
            fieldKey={fileKey}
            onUploadComplete={handleInputChange}
            currentUrl={formData[fileKey]}
            accept=".ttf,.otf,.woff,.woff2,.zip"
          />
        </div>
      </div>
      {i > 1 && (
        <button
          type="button"
          onClick={() => removeFont(type, i)}
          className="absolute top-3 right-3 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    migrateFormData(loadDraft()?.formData as Record<string, unknown> | undefined),
  );
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    () => (loadDraft()?.sectionOrder as string[]) ?? DEFAULT_SECTION_ORDER,
  );
  const [sectionLabels, setSectionLabels] = useState<Record<string, string>>(
    () =>
      (loadDraft()?.sectionLabels as Record<string, string>) ??
      DEFAULT_SECTION_LABELS,
  );
  const [sectionVisibility, setSectionVisibility] = useState<
    Record<string, boolean>
  >(
    () =>
      (loadDraft()?.sectionVisibility as Record<string, boolean>) ??
      DEFAULT_SECTION_VISIBILITY,
  );
  const [placeholderSections, setPlaceholderSections] = useState<
    PlaceholderSection[]
  >(() => (loadDraft()?.placeholderSections as PlaceholderSection[]) ?? []);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    s3_url: string;
    vars_url?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(
    () => !!localStorage.getItem(DRAFT_KEY),
  );
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [primaryColorCount, setPrimaryColorCount] = useState<number>(() => {
    const draft = loadDraft();
    return (
      (draft?.primaryColorCount as number) ??
      deriveIndexedCount(
        draft?.formData as Record<string, string>,
        "colors_primary",
      )
    );
  });
  const [secondaryColorCount, setSecondaryColorCount] = useState<number>(() => {
    const draft = loadDraft();
    return (
      (draft?.secondaryColorCount as number) ??
      deriveIndexedCount(
        draft?.formData as Record<string, string>,
        "colors_secondary",
      )
    );
  });
  const [primaryFontCount, setPrimaryFontCount] = useState<number>(() => {
    const draft = loadDraft();
    return (
      (draft?.primaryFontCount as number) ??
      deriveIndexedCount(
        draft?.formData as Record<string, string>,
        "typography_primary",
      )
    );
  });
  const [secondaryFontCount, setSecondaryFontCount] = useState<number>(() => {
    const draft = loadDraft();
    return (
      (draft?.secondaryFontCount as number) ??
      deriveIndexedCount(
        draft?.formData as Record<string, string>,
        "typography_secondary",
      )
    );
  });
  const [tertiaryColorCount, setTertiaryColorCount] = useState<number>(() => {
    const draft = loadDraft();
    const stored = draft?.tertiaryColorCount;
    if (typeof stored === "number" && stored > 0) return stored;
    const derived = deriveIndexedCount(
      draft?.formData as Record<string, string>,
      "colors_tertiary",
    );
    return Math.max(1, derived);
  });
  const [colorGroupLabels, setColorGroupLabels] = useState<
    Record<ColorGroup, string>
  >(() => {
    const stored = loadDraft()?.colorGroupLabels as
      | Partial<Record<ColorGroup, string>>
      | undefined;
    return { ...DEFAULT_COLOR_GROUP_LABELS, ...(stored ?? {}) };
  });
  const [illustrationTileCount, setIllustrationTileCount] = useState<number>(
    () => {
      const draft = loadDraft();
      const stored = draft?.illustrationTileCount;
      if (typeof stored === "number" && stored > 0) return stored;
      return 4;
    },
  );
  const [illustrationTileLabels, setIllustrationTileLabels] = useState<
    Record<number, string>
  >(() => {
    const stored = loadDraft()?.illustrationTileLabels;
    return (stored as Record<number, string>) ?? {};
  });
  const [imageTileCount, setImageTileCount] = useState<number>(() => {
    const draft = loadDraft();
    const stored = draft?.imageTileCount;
    if (typeof stored === "number" && stored > 0) return stored;
    return 4;
  });
  const [imageTileLabels, setImageTileLabels] = useState<Record<number, string>>(
    () => {
      const stored = loadDraft()?.imageTileLabels;
      return (stored as Record<number, string>) ?? {};
    },
  );
  const [collateralItems, setCollateralItems] = useState<
    { id: string; label: string }[]
  >(() => {
    const stored = loadDraft()?.collateralItems as
      | { id: string; label: string }[]
      | undefined;
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return DEFAULT_COLLATERAL_ITEMS.map((item) => ({ ...item }));
  });
  const [loadClientName, setLoadClientName] = useState("");
  const [loadClientStatus, setLoadClientStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [loadClientError, setLoadClientError] = useState<string | null>(null);
  const [pageCheckStatus, setPageCheckStatus] = useState<
    "idle" | "checking" | "found" | "not-found"
  >("idle");
  const [copiedUrl, setCopiedUrl] = useState<"s3" | "vars" | null>(null);
  const [allClients, setAllClients] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = loadClientName.trim();
    if (!trimmed) {
      setPageCheckStatus("idle");
      return;
    }
    setPageCheckStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/load-client?brand=${encodeURIComponent(trimmed)}`,
        );
        setPageCheckStatus(res.ok ? "found" : "not-found");
      } catch {
        setPageCheckStatus("not-found");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [loadClientName]);

  useEffect(() => {
    fetch("/api/list-clients")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.clients) setAllClients(data.clients);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            formData,
            sectionOrder,
            sectionLabels,
            sectionVisibility,
            placeholderSections,
            primaryColorCount,
            secondaryColorCount,
            tertiaryColorCount,
            colorGroupLabels,
            primaryFontCount,
            secondaryFontCount,
            illustrationTileCount,
            illustrationTileLabels,
            imageTileCount,
            imageTileLabels,
            collateralItems,
            savedAt: new Date().toISOString(),
          }),
        );
        setDraftSavedAt(new Date());
      } catch {
        // localStorage unavailable (private browsing quota, etc.)
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    formData,
    sectionOrder,
    sectionLabels,
    sectionVisibility,
    placeholderSections,
    primaryColorCount,
    secondaryColorCount,
    tertiaryColorCount,
    colorGroupLabels,
    primaryFontCount,
    secondaryFontCount,
    illustrationTileCount,
    illustrationTileLabels,
    imageTileCount,
    imageTileLabels,
    collateralItems,
  ]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setFormData({});
    setSectionOrder(DEFAULT_SECTION_ORDER);
    setSectionLabels(DEFAULT_SECTION_LABELS);
    setSectionVisibility(DEFAULT_SECTION_VISIBILITY);
    setPlaceholderSections([]);
    setValidationErrors({});
    setDraftSavedAt(null);
    setShowDraftBanner(false);
    setPrimaryColorCount(1);
    setSecondaryColorCount(1);
    setTertiaryColorCount(1);
    setColorGroupLabels({ ...DEFAULT_COLOR_GROUP_LABELS });
    setPrimaryFontCount(1);
    setSecondaryFontCount(1);
    setIllustrationTileCount(4);
    setIllustrationTileLabels({});
    setImageTileCount(4);
    setImageTileLabels({});
    setCollateralItems(DEFAULT_COLLATERAL_ITEMS.map((item) => ({ ...item })));
  };

  const copyToClipboard = (text: string, which: "s3" | "vars") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(which);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const handleLoadClient = async () => {
    const trimmed = loadClientName.trim();
    if (!trimmed) return;
    setLoadClientStatus("loading");
    setLoadClientError(null);
    try {
      const res = await fetch(
        `/api/load-client?brand=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load client");
      }
      const vars: Record<string, unknown> = await res.json();

      const incomingOrder = vars.section_order as string[] | undefined;
      if (incomingOrder) {
        setSectionOrder(incomingOrder);
        const visibleSet = new Set(incomingOrder);
        setSectionVisibility(
          DEFAULT_SECTION_ORDER.reduce<Record<string, boolean>>((acc, id) => {
            acc[id] = visibleSet.has(id);
            return acc;
          }, {}),
        );
      }

      const incomingLabels = vars.section_labels as
        | Record<string, string>
        | undefined;
      if (incomingLabels)
        setSectionLabels({ ...DEFAULT_SECTION_LABELS, ...incomingLabels });

      setPlaceholderSections(
        (vars.placeholder_sections as PlaceholderSection[]) ?? [],
      );

      const incomingColorGroupLabels = vars.colors_group_labels as
        | Partial<Record<ColorGroup, string>>
        | undefined;
      setColorGroupLabels({
        ...DEFAULT_COLOR_GROUP_LABELS,
        ...(incomingColorGroupLabels ?? {}),
      });

      const {
        section_order: _o,
        section_labels: _l,
        placeholder_sections: _p,
        colors_group_labels: _cgl,
        collateral_items: _ci,
        collateralItems: _ci2,
        ...rest
      } = vars;
      const restData = migrateFormData(rest as Record<string, unknown>);
      setFormData(restData);
      setPrimaryColorCount(
        Math.max(1, deriveIndexedCount(restData, "colors_primary")),
      );
      setSecondaryColorCount(
        Math.max(1, deriveIndexedCount(restData, "colors_secondary")),
      );
      setTertiaryColorCount(
        Math.max(1, deriveIndexedCount(restData, "colors_tertiary")),
      );
      setPrimaryFontCount(
        Math.max(1, deriveIndexedCount(restData, "typography_primary")),
      );
      setSecondaryFontCount(
        Math.max(1, deriveIndexedCount(restData, "typography_secondary")),
      );
      const illustrationCount = Math.max(
        4,
        deriveIndexedCount(restData, "illustrations_tile_download_link"),
      );
      setIllustrationTileCount(illustrationCount);
      setIllustrationTileLabels({});
      const imageCount = Math.max(
        4,
        deriveIndexedCount(restData, "images_tile_download_link"),
      );
      setImageTileCount(imageCount);
      setImageTileLabels({});
      const incomingCollateralItems = (vars.collateral_items ||
        vars.collateralItems) as
        | { id: string; label: string }[]
        | undefined;
      if (Array.isArray(incomingCollateralItems) && incomingCollateralItems.length > 0) {
        setCollateralItems(incomingCollateralItems);
      } else {
        setCollateralItems(
          DEFAULT_COLLATERAL_ITEMS.map((item) => ({ ...item })),
        );
      }

      setValidationErrors({});
      setLoadClientStatus("success");
      setTimeout(() => setLoadClientStatus("idle"), 2000);
    } catch (err) {
      setLoadClientError(err instanceof Error ? err.message : "Unknown error");
      setLoadClientStatus("error");
    }
  };

  const toggleSectionVisibility = (id: string) => {
    setSectionVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSectionLabel = (id: string, value: string) => {
    setSectionLabels((prev) => ({ ...prev, [id]: value }));
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    id: string,
  ) => {
    setDraggedSection(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    id: string,
  ) => {
    event.preventDefault();
    if (dragOverSection !== id) {
      setDragOverSection(id);
    }
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    id: string,
  ) => {
    event.preventDefault();
    setDragOverSection((current) => (current === id ? null : current));
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    event.preventDefault();
    const draggedId =
      event.dataTransfer.getData("text/plain") || draggedSection;
    if (!draggedId || draggedId === targetId) {
      setDragOverSection(null);
      setDraggedSection(null);
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const shouldInsertAfter =
      event.clientY > targetRect.top + targetRect.height / 2;

    setSectionOrder((previous) => {
      const filtered = previous.filter((id) => id !== draggedId);
      const targetIndex = filtered.indexOf(targetId);
      if (targetIndex === -1) return previous;
      const insertionIndex = Math.max(
        0,
        targetIndex + (shouldInsertAfter ? 1 : 0),
      );
      const updated = [...filtered];
      updated.splice(insertionIndex, 0, draggedId);
      return updated;
    });

    setDragOverSection(null);
    setDraggedSection(null);
  };

  const handleDragEnd = () => {
    setDraggedSection(null);
    setDragOverSection(null);
  };

  const addPlaceholderSection = () => {
    setPlaceholderSections((prev) => [...prev, createEmptyPlaceholder()]);
  };

  const updatePlaceholderSection = (
    index: number,
    field: string,
    value: string,
  ) => {
    setPlaceholderSections((prev) =>
      prev.map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section,
      ),
    );
  };

  const removePlaceholderSection = (index: number) => {
    setPlaceholderSections((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!formData[key]?.trim()) {
        errors[key] = `${label} is required`;
      }
    }
    if (!formData["colors_primary_1_hex"]?.trim()) {
      errors["colors_primary_1_hex"] = "At least one primary color is required";
    }
    if (!formData["colors_secondary_1_hex"]?.trim()) {
      errors["colors_secondary_1_hex"] =
        "At least one secondary color is required";
    }
    if (!formData["typography_primary_1_name"]?.trim()) {
      errors["typography_primary_1_name"] =
        "At least one primary font is required";
    }
    if (!formData["typography_secondary_1_name"]?.trim()) {
      errors["typography_secondary_1_name"] =
        "At least one secondary font is required";
    }
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      const sectionsWithErrors = new Set<string>(
        REQUIRED_FIELDS.filter((f) => errors[f.key]).map((f) => f.section),
      );
      if (errors["colors_primary_1_hex"] || errors["colors_secondary_1_hex"]) {
        sectionsWithErrors.add("colors");
      }
      if (
        errors["typography_primary_1_name"] ||
        errors["typography_secondary_1_name"]
      ) {
        sectionsWithErrors.add("typography");
      }
      setSectionVisibility((prev) => {
        const next = { ...prev };
        sectionsWithErrors.forEach((s) => {
          next[s] = true;
        });
        return next;
      });
      const firstErrorKey =
        REQUIRED_FIELDS.find((f) => errors[f.key])?.key ??
        (errors["colors_primary_1_hex"]
          ? "colors_primary_1_hex"
          : errors["colors_secondary_1_hex"]
            ? "colors_secondary_1_hex"
            : errors["typography_primary_1_name"]
              ? "typography_primary_1_name"
              : "typography_secondary_1_name");
      if (firstErrorKey) {
        setTimeout(() => {
          document
            .getElementById(`field-${firstErrorKey}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    const payload: Record<string, unknown> = {
      ...formData,
      section_order: sectionOrder.filter(
        (id) => sectionVisibility[id] || REQUIRED_SECTIONS.has(id),
      ),
      section_labels: sectionLabels,
      colors_group_labels: colorGroupLabels,
    };

    const buildTilePayload = (
      countKey: string,
      labelKeyTemplate: string,
      urlKeyTemplate: string,
      legacyUrlTemplate: string,
      count: number,
      labels: Record<number, string>,
      defaultLabelPrefix: string,
    ) => {
      let emitted = 0;
      for (let i = 1; i <= count; i++) {
        const url = formData[legacyUrlTemplate.replace("{n}", String(i))];
        if (!url) continue;
        emitted += 1;
        payload[urlKeyTemplate.replace("{n}", String(emitted))] = url;
        const label =
          labels[i]?.trim() || `${defaultLabelPrefix} ${emitted}`;
        payload[labelKeyTemplate.replace("{n}", String(emitted))] = label;
      }
      payload[countKey] = String(emitted);
    };

    buildTilePayload(
      "images_tile_count",
      "images_tile_{n}_label",
      "images_tile_{n}_url",
      "images_tile_download_link_{n}",
      imageTileCount,
      imageTileLabels,
      DEFAULT_DYNAMIC_TILE_LABEL.images,
    );

    buildTilePayload(
      "illustrations_tile_count",
      "illustrations_tile_{n}_label",
      "illustrations_tile_{n}_url",
      "illustrations_tile_download_link_{n}",
      illustrationTileCount,
      illustrationTileLabels,
      DEFAULT_DYNAMIC_TILE_LABEL.illustrations,
    );

    let collateralEmitted = 0;
    for (const item of collateralItems) {
      const url = formData[`collaterals_item_${item.id}_download_link`];
      if (!url) continue;
      collateralEmitted += 1;
      payload[`collaterals_item_${collateralEmitted}_url`] = url;
      payload[`collaterals_item_${collateralEmitted}_label`] =
        item.label.trim() || `Collateral ${collateralEmitted}`;
    }
    payload.collaterals_item_count = String(collateralEmitted);

    const normalizedPlaceholders = placeholderSections
      .map((section) => ({ ...section }))
      .filter(placeholderHasContent);

    if (normalizedPlaceholders.length > 0) {
      payload.placeholder_sections = normalizedPlaceholders;
    }

    try {
      const res = await fetch("/api/generate-branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate branding page");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error(err);
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const renderSectionFields = (sectionId: string) => {
    switch (sectionId) {
      case "brand":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="field-brand_name">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.brand_name || ""}
                onChange={(e) =>
                  handleInputChange("brand_name", e.target.value)
                }
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  validationErrors.brand_name
                    ? "border-red-400 ring-1 ring-red-300"
                    : "border-gray-300"
                }`}
                placeholder="e.g. Acme Corp"
              />
              {validationErrors.brand_name && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {validationErrors.brand_name}
                </p>
              )}
            </div>
            <div id="field-brand_logo_url">
              <FileUpload
                label="Brand Logo *"
                fieldKey="brand_logo_url"
                onUploadComplete={handleInputChange}
                currentUrl={formData.brand_logo_url}
                accept="image/*"
                spec={LOGO_SPEC}
              />
              {validationErrors.brand_logo_url && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {validationErrors.brand_logo_url}
                </p>
              )}
            </div>
            <div id="field-brand_hero_image_url">
              <FileUpload
                label="Brand Hero Image *"
                fieldKey="brand_hero_image_url"
                onUploadComplete={handleInputChange}
                currentUrl={formData.brand_hero_image_url}
                accept="image/*"
                spec={HERO_SPEC}
              />
              {validationErrors.brand_hero_image_url && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {validationErrors.brand_hero_image_url}
                </p>
              )}
            </div>
          </div>
        );
      case "about":
        return (
          <div id="field-about_client_about">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              About Client <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.about_client_about || ""}
              onChange={(e) =>
                handleInputChange("about_client_about", e.target.value)
              }
              rows={4}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                validationErrors.about_client_about
                  ? "border-red-400 ring-1 ring-red-300"
                  : "border-gray-300"
              }`}
              placeholder="Describe the client..."
            />
            {validationErrors.about_client_about && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {validationErrors.about_client_about}
              </p>
            )}
          </div>
        );
      case "logo":
        return (
          <>
            <div className="mb-6" id="field-logo_download_all_logos">
              <FileUpload
                label="Download All Logos *"
                fieldKey="logo_download_all_logos"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_download_all_logos}
                accept=".zip"
              />
              {validationErrors.logo_download_all_logos && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {validationErrors.logo_download_all_logos}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo Description
                </label>
                <textarea
                  value={formData.logo_logo_description || ""}
                  onChange={(e) =>
                    handleInputChange("logo_logo_description", e.target.value)
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div id="field-logo_vertical_download_link">
                <FileUpload
                  label="Vertical Logo *"
                  fieldKey="logo_vertical_download_link"
                  onUploadComplete={handleInputChange}
                  currentUrl={formData.logo_vertical_download_link}
                />
                {validationErrors.logo_vertical_download_link && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors.logo_vertical_download_link}
                  </p>
                )}
              </div>
              <FileUpload
                label="Horizontal Logo"
                fieldKey="logo_horizontal_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_horizontal_download_link}
              />
              <FileUpload
                label="Dark Variant"
                fieldKey="logo_variant_dark_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_variant_dark_download_link}
              />
              <FileUpload
                label="Mono Black"
                fieldKey="logo_variant_mono_black_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_variant_mono_black_download_link}
              />
              <FileUpload
                label="Mono White"
                fieldKey="logo_variant_mono_white_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_variant_mono_white_download_link}
              />

              <h4 className="col-span-full text-sm font-semibold text-gray-900 mt-4">
                Favicons
              </h4>
              <FileUpload
                label="Favicon Primary"
                fieldKey="logo_favicon_light_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_favicon_light_download_link}
              />
              <FileUpload
                label="Favicon Secondary"
                fieldKey="logo_favicon_dark_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_favicon_dark_download_link}
              />
              <FileUpload
                label="Favicon Mono White"
                fieldKey="logo_favicon_mono_white_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_favicon_mono_white_download_link}
              />
              <FileUpload
                label="Favicon Mono Black"
                fieldKey="logo_favicon_mono_black_download_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.logo_favicon_mono_black_download_link}
              />
            </div>
          </>
        );
      case "colors": {
        const groupState: Record<
          ColorGroup,
          { count: number; setCount: React.Dispatch<React.SetStateAction<number>>; required: boolean }
        > = {
          primary: {
            count: primaryColorCount,
            setCount: setPrimaryColorCount,
            required: true,
          },
          secondary: {
            count: secondaryColorCount,
            setCount: setSecondaryColorCount,
            required: true,
          },
          tertiary: {
            count: tertiaryColorCount,
            setCount: setTertiaryColorCount,
            required: false,
          },
        };

        const removeColor = (group: ColorGroup, idx: number) => {
          const { count, setCount } = groupState[group];
          const fields = ["hex", "name", "cmyk"];
          setFormData((prev) => {
            const next = { ...prev };
            for (let i = idx; i < count; i++) {
              fields.forEach((f) => {
                const fromKey = `colors_${group}_${i + 1}_${f}`;
                const toKey = `colors_${group}_${i}_${f}`;
                if (next[fromKey] !== undefined) next[toKey] = next[fromKey];
                else delete next[toKey];
              });
            }
            fields.forEach((f) => delete next[`colors_${group}_${count}_${f}`]);
            return next;
          });
          setCount((c) => Math.max(1, c - 1));
        };

        const renderGroup = (group: ColorGroup) => {
          const { count, setCount, required } = groupState[group];
          const label = colorGroupLabels[group];
          const validationErrorKey = `colors_${group}_1_hex`;
          return (
            <div key={group}>
              <div className="flex flex-col gap-3 mt-6 mb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 w-full md:max-w-md">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) =>
                      setColorGroupLabels((prev) => ({
                        ...prev,
                        [group]: e.target.value,
                      }))
                    }
                    placeholder={DEFAULT_COLOR_GROUP_LABELS[group]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-md font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {required && <span className="text-red-500">*</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setCount((c) => c + 1)}
                  className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4" /> Add Color
                </button>
              </div>
              {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
                <div
                  key={i}
                  id={i === 1 ? `field-${validationErrorKey}` : undefined}
                  className="relative"
                >
                  {required &&
                    validationErrors[validationErrorKey] &&
                    i === 1 && (
                      <p className="mb-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />{" "}
                        {validationErrors[validationErrorKey]}
                      </p>
                    )}
                  <div className="relative">
                    <ColorInput
                      label={`${label || DEFAULT_COLOR_GROUP_LABELS[group]} ${i}`}
                      prefix={`colors_${group}_${i}`}
                      values={formData}
                      onChange={(key, val) => {
                        handleInputChange(key, val);
                        if (required && i === 1 && key === validationErrorKey) {
                          setValidationErrors((prev) => {
                            const n = { ...prev };
                            delete n[validationErrorKey];
                            return n;
                          });
                        }
                      }}
                    />
                    {i > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColor(group, i)}
                        className="absolute top-3 right-3 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        };

        return (
          <>
            <FileUpload
              label="Download Color Palette (PDF/ASE)"
              fieldKey="colors_download_link"
              onUploadComplete={handleInputChange}
              currentUrl={formData.colors_download_link}
            />
            {COLOR_GROUPS.map(renderGroup)}
          </>
        );
      }
      case "typography": {
        const removeFont = (type: "primary" | "secondary", idx: number) => {
          const count =
            type === "primary" ? primaryFontCount : secondaryFontCount;
          const setCount =
            type === "primary" ? setPrimaryFontCount : setSecondaryFontCount;
          const fields = ["name", "file"];
          setFormData((prev) => {
            const next = { ...prev };
            for (let i = idx; i < count; i++) {
              fields.forEach((f) => {
                const fromKey = `typography_${type}_${i + 1}_${f}`;
                const toKey = `typography_${type}_${i}_${f}`;
                if (next[fromKey] !== undefined) next[toKey] = next[fromKey];
                else delete next[toKey];
              });
            }
            fields.forEach(
              (f) => delete next[`typography_${type}_${count}_${f}`],
            );
            return next;
          });
          setCount((c) => c - 1);
        };

        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">
                Primary Fonts <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={() => setPrimaryFontCount((c) => c + 1)}
                className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-4 w-4" /> Add Primary Font
              </button>
            </div>
            {Array.from({ length: primaryFontCount }, (_, i) => i + 1).map(
              (i) => (
                <TypographyFontCard
                  key={i}
                  type="primary"
                  i={i}
                  formData={formData}
                  validationErrors={validationErrors}
                  handleInputChange={handleInputChange}
                  removeFont={removeFont}
                  clearValidationError={(key) =>
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                />
              ),
            )}

            <div className="flex items-center justify-between mt-6 mb-4">
              <h3 className="text-md font-medium text-gray-900">
                Secondary Fonts <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={() => setSecondaryFontCount((c) => c + 1)}
                className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-4 w-4" /> Add Secondary Font
              </button>
            </div>
            {Array.from({ length: secondaryFontCount }, (_, i) => i + 1).map(
              (i) => (
                <TypographyFontCard
                  key={i}
                  type="secondary"
                  i={i}
                  formData={formData}
                  validationErrors={validationErrors}
                  handleInputChange={handleInputChange}
                  removeFont={removeFont}
                  clearValidationError={(key) =>
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                />
              ),
            )}

            <div className="mt-6">
              <FileUpload
                label="Download All Fonts (Zip)"
                fieldKey="typography_download_fonts"
                onUploadComplete={handleInputChange}
                currentUrl={formData.typography_download_fonts}
                accept=".zip"
              />
            </div>
          </>
        );
      }
      case "illustrations":
      case "images": {
        const section: DynamicTileSection = sectionId as DynamicTileSection;
        const isIllustrations = section === "illustrations";
        const count = isIllustrations ? illustrationTileCount : imageTileCount;
        const setCount = isIllustrations
          ? setIllustrationTileCount
          : setImageTileCount;
        const labels = isIllustrations
          ? illustrationTileLabels
          : imageTileLabels;
        const setLabels = isIllustrations
          ? setIllustrationTileLabels
          : setImageTileLabels;
        const downloadKey = `${section}_download_link`;
        const downloadAllLabel = isIllustrations
          ? "Download All Illustrations"
          : "Download All Images";
        const addLabel = isIllustrations ? "Add Illustration" : "Add Image";
        const defaultLabel = DEFAULT_DYNAMIC_TILE_LABEL[section];

        const removeTile = (idx: number) => {
          setFormData((prev) => {
            const next = { ...prev };
            for (let i = idx; i < count; i++) {
              const fromKey = `${section}_tile_download_link_${i + 1}`;
              const toKey = `${section}_tile_download_link_${i}`;
              if (next[fromKey] !== undefined) next[toKey] = next[fromKey];
              else delete next[toKey];
            }
            delete next[`${section}_tile_download_link_${count}`];
            return next;
          });
          setLabels((prev) => {
            const next: Record<number, string> = {};
            Object.keys(prev).forEach((k) => {
              const n = Number(k);
              if (n < idx) next[n] = prev[n];
              else if (n > idx) next[n - 1] = prev[n];
            });
            return next;
          });
          setCount((c) => Math.max(1, c - 1));
        };

        return (
          <>
            <FileUpload
              label={downloadAllLabel}
              fieldKey={downloadKey}
              onUploadComplete={handleInputChange}
              currentUrl={formData[downloadKey]}
              accept=".zip"
            />

            <div className="flex items-center justify-end mt-6 mb-2">
              <button
                type="button"
                onClick={() => setCount((c) => c + 1)}
                className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-4 w-4" /> {addLabel}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: count }, (_, idx) => idx + 1).map((num) => {
                const tileLabel = labels[num] ?? "";
                const fieldKey = `${section}_tile_download_link_${num}`;
                return (
                  <div
                    key={num}
                    className="relative rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={tileLabel}
                        onChange={(e) =>
                          setLabels((prev) => ({
                            ...prev,
                            [num]: e.target.value,
                          }))
                        }
                        placeholder={`${defaultLabel} ${num}`}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-9"
                      />
                        {count > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTile(num)}
                          className="absolute top-1/2 -translate-y-1/2 right-2 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <FileUpload
                      label=""
                      fieldKey={fieldKey}
                      onUploadComplete={handleInputChange}
                      currentUrl={formData[fieldKey]}
                    />
                  </div>
                );
              })}
            </div>
          </>
        );
      }
      case "collaterals": {
        const updateItem = (idx: number, patch: { label?: string }) => {
          setCollateralItems((prev) =>
            prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
          );
        };
        const removeItem = (idx: number) => {
          const removed = collateralItems[idx];
          if (!removed) return;
          setCollateralItems((prev) => prev.filter((_, i) => i !== idx));
          setFormData((prev) => {
            const next = { ...prev };
            delete next[`collaterals_item_${removed.id}_download_link`];
            return next;
          });
        };
        const addItem = () => {
          setCollateralItems((prev) => [
            ...prev,
            {
              id: `custom_${Date.now().toString(36)}_${prev.length + 1}`,
              label: `Collateral ${prev.length + 1}`,
            },
          ]);
        };

        return (
          <>
            <FileUpload
              label="Download All Collaterals (Zip)"
              fieldKey="collaterals_download_all_collaterals"
              onUploadComplete={handleInputChange}
              currentUrl={formData.collaterals_download_all_collaterals}
              accept=".zip,.rar,.7z"
            />

            <div className="flex items-center justify-end mt-6 mb-2">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-4 w-4" /> Add Collateral
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collateralItems.map((item, idx) => {
                const isLetterhead = item.id === "letterhead";
                const fieldKey = `collaterals_item_${item.id}_download_link`;
                return (
                  <div
                    key={item.id}
                    className="relative rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) =>
                          updateItem(idx, { label: e.target.value })
                        }
                        placeholder="Collateral name"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="absolute top-1/2 -translate-y-1/2 right-2 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <FileUpload
                      label=""
                      fieldKey={fieldKey}
                      onUploadComplete={handleInputChange}
                      currentUrl={formData[fieldKey]}
                      accept={isLetterhead ? ".zip" : undefined}
                    />
                    {isLetterhead && (
                      <p className="mt-1 text-xs text-gray-500">
                        Upload a ZIP containing print PDF, open-file format, and
                        PNG.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <FileUpload
                label="Proposal Template"
                fieldKey="collaterals_proposal_link"
                onUploadComplete={handleInputChange}
                currentUrl={formData.collaterals_proposal_link}
              />
            </div>
          </>
        );
      }
      case "patterns":
        return (
          <>
            <FileUpload
              label="Download All Patterns"
              fieldKey="patterns_download_link"
              onUploadComplete={handleInputChange}
              currentUrl={formData.patterns_download_link}
              accept=".zip"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <FileUpload
                label="Large Pattern 1"
                fieldKey="patterns_large_download_link_1"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_large_download_link_1}
              />
              <FileUpload
                label="Large Pattern 2"
                fieldKey="patterns_large_download_link_2"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_large_download_link_2}
              />
              <FileUpload
                label="Small Pattern 1"
                fieldKey="patterns_small_download_link_1"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_small_download_link_1}
              />
              <FileUpload
                label="Small Pattern 2"
                fieldKey="patterns_small_download_link_2"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_small_download_link_2}
              />
              <FileUpload
                label="Small Pattern 3"
                fieldKey="patterns_small_download_link_3"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_small_download_link_3}
              />
              <FileUpload
                label="Small Pattern 4"
                fieldKey="patterns_small_download_link_4"
                onUploadComplete={handleInputChange}
                currentUrl={formData.patterns_small_download_link_4}
              />
            </div>
          </>
        );
      case "guidelines":
        return (
          <FileUpload
            label="Brand Guidelines PDF"
            fieldKey="guidelines_download_link"
            onUploadComplete={handleInputChange}
            currentUrl={formData.guidelines_download_link}
            accept=".pdf"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2.5">
            Branding Page Generator
          </h1>
          <p className="text-lg text-gray-600">
            Upload assets and generate a client branding page in seconds.
          </p>
        </div>

        <form id="branding-form" onSubmit={handleSubmit} className="space-y-6">
          {showDraftBanner && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                Draft restored — your previous progress has been loaded.
              </span>
              <button
                type="button"
                onClick={clearDraft}
                className="ml-4 shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                Start fresh
              </button>
            </div>
          )}

          {/* Load existing client */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <label
              htmlFor="load-client-input"
              className="shrink-0 text-sm font-medium text-gray-700"
            >
              Load Client
            </label>
            <div className="relative flex-1" ref={autocompleteRef}>
              <input
                id="load-client-input"
                type="text"
                value={loadClientName}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoadClientName(val);
                  setLoadClientStatus("idle");
                  setLoadClientError(null);
                  setActiveSuggestionIndex(-1);
                  setShowSuggestions(true);
                  if (!val.trim()) setPageCheckStatus("idle");
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  const filtered = allClients.filter((c) =>
                    c
                      .toLowerCase()
                      .includes(loadClientName.toLowerCase().trim()),
                  );
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestionIndex((i) =>
                      Math.min(i + 1, filtered.length - 1),
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((i) => Math.max(i - 1, -1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (
                      activeSuggestionIndex >= 0 &&
                      filtered[activeSuggestionIndex]
                    ) {
                      setLoadClientName(filtered[activeSuggestionIndex]);
                      setShowSuggestions(false);
                      setActiveSuggestionIndex(-1);
                    } else {
                      setShowSuggestions(false);
                      handleLoadClient();
                    }
                  } else if (e.key === "Escape") {
                    setShowSuggestions(false);
                    setActiveSuggestionIndex(-1);
                  }
                }}
                placeholder="Search brand name…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                disabled={loadClientStatus === "loading"}
                autoComplete="off"
              />
              {showSuggestions &&
                loadClientName.trim() &&
                (() => {
                  const filtered = allClients.filter((c) =>
                    c
                      .toLowerCase()
                      .includes(loadClientName.toLowerCase().trim()),
                  );
                  return filtered.length > 0 ? (
                    <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {filtered.map((client, i) => (
                        <li
                          key={client}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setLoadClientName(client);
                            setShowSuggestions(false);
                            setActiveSuggestionIndex(-1);
                          }}
                          className={`cursor-pointer px-3 py-2 text-sm ${
                            i === activeSuggestionIndex
                              ? "bg-indigo-600 text-white"
                              : "text-gray-800 hover:bg-gray-100"
                          }`}
                        >
                          {client}
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()}
            </div>
            <button
              type="button"
              onClick={handleLoadClient}
              disabled={
                loadClientStatus === "loading" || !loadClientName.trim()
              }
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadClientStatus === "loading" ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </span>
              ) : (
                "Load"
              )}
            </button>
            {pageCheckStatus === "checking" && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
            )}
            {pageCheckStatus === "found" && (
              <a
                href={`${S3_BRAND_BASE}/${sanitizeBrandName(loadClientName.trim())}/file.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <ExternalLink className="h-4 w-4" />
                Visit Page
              </a>
            )}
            {pageCheckStatus === "not-found" && loadClientName.trim() && (
              <span className="shrink-0 text-sm text-gray-400">
                No page found
              </span>
            )}
            {loadClientStatus === "success" && (
              <span className="flex shrink-0 items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> Loaded
              </span>
            )}
            {loadClientStatus === "error" && loadClientError && (
              <span className="flex shrink-0 items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {loadClientError}
              </span>
            )}
          </div>

          <Section
            title="Placeholder sections"
            description="Add temporary cards with reference content."
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={addPlaceholderSection}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 ml-auto"
              >
                <Plus className="h-4 w-4" />
                Add placeholder
              </button>
            </div>

            {placeholderSections.length === 0 ? (
              <p className="text-sm text-gray-500">
                No placeholders added yet.
              </p>
            ) : (
              <div className="space-y-4">
                {placeholderSections.map((placeholder, index) => (
                  <div
                    key={`${placeholder.id || "placeholder"}-${index}`}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Placeholder #{index + 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          Appears after the sections above.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlaceholderSection(index)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          ID
                        </label>
                        <input
                          type="text"
                          value={placeholder.id}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "id",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Label
                        </label>
                        <input
                          type="text"
                          value={placeholder.label}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "label",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Title
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_title}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_title",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_subtitle}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_subtitle",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Grid heading
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_grid_heading}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_grid_heading",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Status
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_status}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_status",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Owner
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_owner}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_owner",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-500">
                          Details
                        </label>
                        <textarea
                          value={placeholder.placeholder_details}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_details",
                              event.target.value,
                            )
                          }
                          rows={3}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Grid images
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {PLACEHOLDER_GRID_IMAGE_KEYS.map((key) => (
                          <div key={key}>
                            <label className="text-xs font-medium text-gray-500">
                              Image URL
                            </label>
                            <input
                              type="url"
                              value={placeholder[key]}
                              onChange={(event) =>
                                updatePlaceholderSection(
                                  index,
                                  key,
                                  event.target.value,
                                )
                              }
                              placeholder="https://..."
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        PDF references
                      </p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {PLACEHOLDER_PDF_GROUPS.map((group) => (
                          <div key={group.title} className="space-y-2">
                            <label className="text-xs font-medium text-gray-500">
                              Title
                            </label>
                            <input
                              type="text"
                              value={placeholder[group.title]}
                              onChange={(event) =>
                                updatePlaceholderSection(
                                  index,
                                  group.title,
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />
                            <label className="text-xs font-medium text-gray-500">
                              Description
                            </label>
                            <input
                              type="text"
                              value={placeholder[group.description]}
                              onChange={(event) =>
                                updatePlaceholderSection(
                                  index,
                                  group.description,
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />
                            <label className="text-xs font-medium text-gray-500">
                              Link
                            </label>
                            <input
                              type="url"
                              value={placeholder[group.link]}
                              onChange={(event) =>
                                updatePlaceholderSection(
                                  index,
                                  group.link,
                                  event.target.value,
                                )
                              }
                              placeholder="https://..."
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          CTA label
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_cta_label}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_cta_label",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          CTA link
                        </label>
                        <input
                          type="url"
                          value={placeholder.placeholder_cta_link}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_cta_link",
                              event.target.value,
                            )
                          }
                          placeholder="https://..."
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Progress label
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_progress}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_progress",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Progress %
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_progress_pct}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_progress_pct",
                              event.target.value,
                            )
                          }
                          placeholder="e.g. 45"
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-500">
                          Footnote
                        </label>
                        <input
                          type="text"
                          value={placeholder.placeholder_footnote}
                          onChange={(event) =>
                            updatePlaceholderSection(
                              index,
                              "placeholder_footnote",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="space-y-4">
            {sectionOrder.map((sectionId, index) => {
              const definition = SECTION_DEFINITIONS.find(
                (section) => section.id === sectionId,
              );
              if (!definition) return null;
              const isVisible = sectionVisibility[sectionId];
              const sectionContent = renderSectionFields(sectionId);

              return (
                <div
                  key={sectionId}
                  onDragOver={(event) => handleDragOver(event, sectionId)}
                  onDragEnter={(event) => handleDragOver(event, sectionId)}
                  onDragLeave={(event) => handleDragLeave(event, sectionId)}
                  onDrop={(event) => handleDrop(event, sectionId)}
                  className={`rounded-3xl transition ${
                    dragOverSection === sectionId
                      ? "ring-2 ring-indigo-300 shadow-lg"
                      : ""
                  }`}
                >
                  <Section
                    title={
                      <div className="flex items-center gap-2">
                        <span>{definition.title}</span>
                        <span className="text-xs text-gray-400">
                          #{index + 1}
                        </span>
                        {REQUIRED_SECTIONS.has(sectionId) && (
                          <span className="text-xs font-medium text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                    }
                    description={
                      <div className="mt-3 space-y-1">
                        <label
                          htmlFor={`section-label-${sectionId}`}
                          className="text-xs font-semibold text-gray-500"
                        >
                          Label
                        </label>
                        <input
                          id={`section-label-${sectionId}`}
                          type="text"
                          value={sectionLabels[sectionId]}
                          onChange={(event) =>
                            updateSectionLabel(sectionId, event.target.value)
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    }
                    headerActions={
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleSectionVisibility(sectionId)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          {isVisible ? "Visible" : "Hidden"}
                        </label>
                        <div
                          draggable
                          onDragStart={(event) =>
                            handleDragStart(event, sectionId)
                          }
                          onDragEnd={handleDragEnd}
                          className="cursor-grab text-gray-400 hover:text-gray-600"
                          aria-label="Drag to reorder"
                        >
                          <GripVertical className="h-5 w-5" />
                        </div>
                      </div>
                    }
                    className={draggedSection === sectionId ? "opacity-90" : ""}
                  >
                    {isVisible ? (
                      sectionContent
                    ) : (
                      <p className="text-sm text-gray-500">
                        Toggle this section on to configure its content.
                      </p>
                    )}
                  </Section>
                </div>
              );
            })}
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg flex justify-end items-center gap-4 z-50">
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-center text-red-600 text-sm mr-auto">
              <AlertCircle className="w-4 h-4 mr-2" />
              {Object.keys(validationErrors).length === 1
                ? "1 required field is missing"
                : `${Object.keys(validationErrors).length} required fields are missing`}
            </div>
          )}
          {error && Object.keys(validationErrors).length === 0 && (
            <div className="flex items-center text-red-600 text-sm mr-auto">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}
          {draftSavedAt &&
            Object.keys(validationErrors).length === 0 &&
            !error && (
              <div className="mr-auto flex items-center gap-3 text-sm text-gray-500">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Draft saved {formatDraftTime(draftSavedAt)}
                <button
                  type="button"
                  onClick={clearDraft}
                  className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
            )}
          <button
            type="submit"
            form="branding-form"
            disabled={generating}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg text-white font-semibold text-lg shadow-md transition-all
              ${
                generating
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:transform active:scale-95"
              }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Branding Page"
            )}
          </button>
        </div>

        {result && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600 mb-6">
                Your branding page has been generated successfully.
              </p>

              <div className="mb-3 text-left">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Branding Page
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <a
                    href={result.s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-sm text-indigo-600 hover:underline"
                  >
                    {result.s3_url}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.s3_url, "s3")}
                    className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copiedUrl === "s3" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {result.vars_url && (
                <div className="mb-6 text-left">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Client Data
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex-1 truncate text-sm text-gray-600">
                      {result.vars_url}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.vars_url!, "vars")}
                      className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      {copiedUrl === "vars" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setResult(null);
                    setCopiedUrl(null);
                  }}
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
      <div className="h-20" />
    </div>
  );
}
