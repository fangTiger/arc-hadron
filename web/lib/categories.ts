export interface CategoryDisplay {
  label: string;
  gradient: string;
}

const categoryDisplays: Record<string, CategoryDisplay> = {
  treasuries: {
    label: "TREASURIES",
    gradient: "radial-gradient(circle at 20% 20%, #22d3ee 0%, #155e75 42%, #07111a 100%)",
  },
  gold: {
    label: "GOLD",
    gradient: "radial-gradient(circle at 20% 20%, #e9c46a 0%, #7c5c1e 44%, #11100b 100%)",
  },
  "real-estate": {
    label: "REAL ESTATE",
    gradient: "radial-gradient(circle at 20% 20%, #4b647d 0%, #1d2733 46%, #080b10 100%)",
  },
  carbon: {
    label: "CARBON",
    gradient: "radial-gradient(circle at 20% 20%, #34d399 0%, #1e4d3a 44%, #07100c 100%)",
  },
};

export function categoryDisplay(category: string): CategoryDisplay {
  return categoryDisplays[category] ?? categoryDisplays["real-estate"];
}
