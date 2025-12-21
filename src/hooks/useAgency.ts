import { useEffect } from 'react';
import { useAgencyStore } from '../stores/agencyStore';
import { useAuth } from './useAuth';

export function useAgency() {
  // useAuth uses Zustand store, so it should always return a valid object
  // But be defensive and handle edge cases
  const authResult = useAuth();
  const profile = authResult?.profile || null;
  
  const { agency, loading, fetchAgency, updateAgency } = useAgencyStore();

  useEffect(() => {
    if (profile?.agency_id) {
      // Fetch if no agency or if agency ID has changed
      if (!agency || agency.id !== profile.agency_id) {
        fetchAgency(profile.agency_id);
      }
    }
  }, [profile?.agency_id, agency, fetchAgency]);

  return {
    agency: agency || null,
    loading: loading || false,
    updateAgency,
    refetch: () => profile?.agency_id && fetchAgency(profile.agency_id),
  };
}

