import { create } from 'zustand';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { isDemoMode } from '../lib/firebase/config';

interface Agency {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string | null;
  logoURL?: string | null;
  company_profile_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
  theme_mode?: 'light' | 'dark' | 'auto';
  email?: string;
  phone?: string;
  address?: string;
  settings?: Record<string, any>;
}

interface AgencyState {
  agency: Agency | null;
  loading: boolean;
  fetchAgency: (agencyId: string) => Promise<void>;
  updateAgency: (updates: Partial<Agency>) => Promise<void>;
}

export const useAgencyStore = create<AgencyState>((set, get) => ({
  agency: null,
  loading: false,

  fetchAgency: async (agencyId: string) => {
    set({ loading: true });
    try {
      if (isDemoMode) {
        set({ 
          agency: { 
            id: 'demo-agency-id', 
            name: 'Demo Agency',
            email: 'demo@example.com',
            phone: '+260 123 456 789',
            address: 'Demo Address',
          }, 
          loading: false 
        });
        return;
      }

      const agencyRef = doc(db, 'agencies', agencyId);
      const agencySnap = await getDoc(agencyRef);

      if (agencySnap.exists()) {
        const data = agencySnap.data();
        // Default AI to enabled if not set
        const settings = data.settings || {};
        if (settings.aiEnabled === undefined) {
          settings.aiEnabled = true;
        }
        set({ 
          agency: { 
            id: agencySnap.id, 
            ...data,
            logo_url: data.logoURL || data.logo_url,
            settings,
          } as Agency, 
          loading: false 
        });
      } else {
        set({ agency: null, loading: false });
      }
    } catch (error) {
      console.error('Error fetching agency:', error);
      set({ loading: false });
    }
  },

  updateAgency: async (updates: Partial<Agency>) => {
    const { agency } = get();
    if (!agency) return;

    try {
      if (isDemoMode) {
        set({ agency: { ...agency, ...updates } as Agency });
        return;
      }

      const agencyRef = doc(db, 'agencies', agency.id);
      
      // Filter out undefined values - Firestore doesn't allow undefined
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      await updateDoc(agencyRef, {
        ...cleanUpdates,
        updatedAt: new Date(),
      });
      
      set({ agency: { ...agency, ...updates } as Agency });
    } catch (error) {
      console.error('Error updating agency:', error);
      throw error;
    }
  },
}));

