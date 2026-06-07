export interface Car {
  vehicleId: string;
  title: string;
  make: string;
  model: string;
  variant: string;
  year: number | null;
  price: string;
  originalPrice?: string;
  emi: string;
  mileage: string;
  fuel: string;
  transmission: string;
  rto: string;
  owners: string;
  location: string;
  badge: string;
  detailUrl: string;
  imageUrl: string;
  images: string[];
  relevanceScore?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cars?: Car[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatResponse {
  answer: string;
  cars: Car[];
  sources_count: number;
}
