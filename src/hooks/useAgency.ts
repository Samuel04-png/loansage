import { useEffect } from 'react';
import { useAgencyStore } from '../stores/agencyStore';
import { useAuth } from './useAuth';

export function useAgency() {
  const { profile } = useAuth();
  const { agency, loading, fetchAgency, updateAgency } = useAgencyStore();

  useEffect(() => {
    if (profile?.agency_id && !agency) {
      fetchAgency(profile.agency_id);
    }
  }, [profile?.agency_id, agency, fetchAgency]);

  return {
    agency,
    loading,
    updateAgency,
    refetch: () => profile?.agency_id && fetchAgency(profile.agency_id),
  };
}

