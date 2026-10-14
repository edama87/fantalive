import { NextResponse } from 'next/server';
import { isPDFContent, parseFMSRevoPDF } from '@/lib/fmsrevo-pdf-parser';
import fs from 'fs';
import path from 'path';

const FIXTURE_PDF_BASE64 = 'JVBERi0xLjcKCjQgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAyNQo+PgpzdHJlYW0KeJzLy0zOz0nNBQALpgLPCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvUGFnZQovTWVkaWFCb3ggWzAgMCA1OTUuMjggODQxLjg5XQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAzIDAgUgo+Pgo+PgovQ29udGVudHMgNCAwIFIKL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFs1IDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNTk1LjI4IDg0MS44OV0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyODYgMDAwMDAgbiAKMDAwMDAwMDMzNSAwMDAwMCBuIAowMDAwMDAwNDI4IDAwMDAwIG4gCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDEwMyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjUwOQolJUVPRgo=';

const MOCK_TEAMS = [
  { id: 'little-eagles', name: 'Little Eagles' },
  { id: 'salen-team', name: 'Salen Team' },
  { id: 'dinamo-cecchignola', name: 'Dinamo Cecchignola 1927' },
  { id: 'amatori-prosecco', name: 'Amatori ProSecco' },
  { id: 'atletico-magari', name: 'Atletico Magari' },
  { id: 'yellow-mustard', name: 'Yellow Mustard' },
  { id: 'real-pedrotte', name: 'Real Pedrotte' },
  { id: 'sfortonia', name: 'Sfortonia' },
  { id: 'football-and-city', name: 'Football And City' },
  { id: 'parisso', name: 'Parisso San Gennaro' },
];

export async function GET() {
  const startTime = Date.now();
  
  try {
    let pdfData: Uint8Array;
    
    const fixturePath = path.join(process.cwd(), 'src/lib/__tests__/fixtures/formaz_g7_sample.pdf');
    if (fs.existsSync(fixturePath)) {
      pdfData = new Uint8Array(fs.readFileSync(fixturePath));
    } else {
      pdfData = new Uint8Array(Buffer.from(FIXTURE_PDF_BASE64, 'base64'));
    }
    
    if (!isPDFContent(pdfData)) {
      return NextResponse.json({
        ok: false,
        error: 'Fixture non riconosciuto come PDF',
        parseTimeMs: Date.now() - startTime,
      }, { status: 500 });
    }
    
    const result = await parseFMSRevoPDF(pdfData, MOCK_TEAMS);
    
    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.message || 'Parse fallito',
        parseTimeMs: Date.now() - startTime,
      }, { status: 500 });
    }
    
    const parissoTeam = result.teams.find(t => 
      t.rawTeamName.toLowerCase().includes('parisso') ||
      t.matchedTeamId === 'parisso'
    );
    
    return NextResponse.json({
      ok: true,
      totalTeams: result.teams.length,
      teamsWithLineups: result.teams.filter(t => t.hasLineup).length,
      parissoStarters: parissoTeam?.starters.length ?? null,
      parissoBench: parissoTeam?.bench.length ?? null,
      serieAMatchday: result.serieAMatchday,
      fantasyMatchday: result.fantasyMatchday,
      parseTimeMs: Date.now() - startTime,
      teams: result.teams.map(t => ({
        name: t.rawTeamName,
        starters: t.starters.length,
        bench: t.bench.length,
        hasLineup: t.hasLineup,
      })),
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json({
      ok: false,
      error: errorMsg.substring(0, 200),
      parseTimeMs: Date.now() - startTime,
    }, { status: 500 });
  }
}
