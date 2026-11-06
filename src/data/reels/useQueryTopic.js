import {useMemo} from 'react';
import {useLocation} from '@docusaurus/router';

// Shared by the reels page router and the deck viewer so both agree on
// which topic the ?topic= query param selects.
export default function useQueryTopic() {
  const {search} = useLocation();
  return useMemo(() => new URLSearchParams(search).get('topic') || '', [search]);
}
