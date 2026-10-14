import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchFMSRevoRosters } from '@/lib/fmsrevo-client';
import { isPDFContent } from '@/lib/fmsrevo-pdf-parser';

export async function POST() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');
  
  if (!adminSession || adminSession.value !== 'authenticated') {
    return NextResponse.json(
      { success: false, error: 'Non autorizzato' },
      { status: 401 }
    );
  }

  try {
    const result = await fetchFMSRevoRosters();
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        candidateLinks: result.candidateLinks || [],
        message: 'Pagina rose non trovata. Verifica i link candidati nei log del server.',
      });
    }

    const isPdf = result.data ? isPDFContent(result.data) : false;
    const contentType = result.contentType || 'unknown';
    const dataSize = result.data?.length || 0;

    if (!isPdf && result.data) {
      const text = new TextDecoder().decode(result.data);
      const preview = text.substring(0, 500);
      
      return NextResponse.json({
        success: true,
        format: 'html',
        contentType,
        dataSize,
        preview,
        candidateLinks: result.candidateLinks || [],
        message: 'Pagina rose trovata (HTML). Implementazione parsing HTML necessaria.',
      });
    }

    return NextResponse.json({
      success: true,
      format: 'pdf',
      contentType,
      dataSize,
      candidateLinks: result.candidateLinks || [],
      message: 'Pagina rose trovata (PDF). Analisi contenuto in corso.',
    });

  } catch (error) {
    console.error('[API] Error discovering rosters:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno nel recupero delle rose' },
      { status: 500 }
    );
  }
}
