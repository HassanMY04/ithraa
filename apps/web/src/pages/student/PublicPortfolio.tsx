import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Async, C } from '../../components/ui';
import { PortfolioView, type PortfolioData } from './Portfolio';

/** Read-only portfolio behind a share link; no sign-in needed. */
export default function PublicPortfolio() {
  const { token } = useParams();
  const q = useQuery<PortfolioData>({ queryKey: ['public', 'portfolio', token], queryFn: () => api(`/public/portfolio/${token}`), retry: false });
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
      <div style={{ background: C.navy, color: '#FFFFFF', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>إ</div>
        <span style={{ fontSize: 15, color: C.lilac }}>Ithraa · الإثراء المعرفي</span>
      </div>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Async q={q}>{(d) => <PortfolioView d={d} readOnly />}</Async>
      </main>
    </div>
  );
}
