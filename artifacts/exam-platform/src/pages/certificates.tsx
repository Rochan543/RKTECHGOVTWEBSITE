import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useListResults } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { Trophy, Download, Award, CheckCircle2, Star } from 'lucide-react';

const CERTIFICATE_THRESHOLD = 60; // 60% to qualify for certificate

interface CertificateData {
  id: number;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  accuracy: number;
  rank: number | null;
  date: string;
}

function CertificateCard({ cert, userName }: { cert: CertificateData; userName: string }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const el = printRef.current;
    if (!el) return;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head>
        <title>Certificate - ${cert.examTitle}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Georgia, serif; background: #fff; }
          .cert { width: 800px; height: 560px; margin: 20px auto; border: 8px solid #1e3a5f; padding: 40px; position: relative; background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%); }
          .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #c8a94f; pointer-events: none; }
          .header { text-align: center; margin-bottom: 20px; }
          .org { font-size: 13px; letter-spacing: 3px; color: #1e3a5f; text-transform: uppercase; }
          .cert-title { font-size: 36px; color: #c8a94f; margin: 8px 0; font-style: italic; }
          .body { text-align: center; margin: 20px 0; }
          .presented { font-size: 14px; color: #555; letter-spacing: 2px; }
          .name { font-size: 32px; font-weight: bold; color: #1e3a5f; border-bottom: 2px solid #c8a94f; padding-bottom: 8px; display: inline-block; margin: 12px 0; }
          .desc { font-size: 14px; color: #444; line-height: 1.8; }
          .exam-name { font-weight: bold; color: #1e3a5f; }
          .stats { display: flex; justify-content: center; gap: 40px; margin: 20px 0; }
          .stat { text-align: center; }
          .stat-val { font-size: 22px; font-weight: bold; color: #c8a94f; }
          .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          .seal { width: 60px; height: 60px; border-radius: 50%; background: #1e3a5f; color: #c8a94f; display: flex; align-items: center; justify-content: center; font-size: 24px; }
          .sig { text-align: center; }
          .sig-line { width: 140px; border-top: 1px solid #333; margin: 0 auto 4px; }
          .sig-name { font-size: 11px; color: #555; }
        </style>
      </head><body>
        <div class="cert">
          <div class="header">
            <p class="org">SSC Online Examination Platform</p>
            <h1 class="cert-title">Certificate of Achievement</h1>
          </div>
          <div class="body">
            <p class="presented">THIS IS TO CERTIFY THAT</p>
            <p class="name">${userName}</p>
            <p class="desc">has successfully completed the examination</p>
            <p class="desc"><span class="exam-name">${cert.examTitle}</span></p>
          </div>
          <div class="stats">
            <div class="stat"><div class="stat-val">${cert.percentage.toFixed(1)}%</div><div class="stat-label">Score</div></div>
            <div class="stat"><div class="stat-val">${cert.accuracy.toFixed(1)}%</div><div class="stat-label">Accuracy</div></div>
            ${cert.rank ? `<div class="stat"><div class="stat-val">#${cert.rank}</div><div class="stat-label">Rank</div></div>` : ''}
          </div>
          <div class="footer">
            <div>
              <div style="font-size:11px;color:#888;">Date of Issue</div>
              <div style="font-size:13px;">${new Date(cert.date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>
            </div>
            <div class="seal">★</div>
            <div class="sig">
              <div class="sig-line"></div>
              <div class="sig-name">Platform Administrator</div>
            </div>
          </div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const grade = cert.percentage >= 90 ? 'A+' : cert.percentage >= 80 ? 'A' : cert.percentage >= 70 ? 'B' : 'C';
  const gradeColor = cert.percentage >= 90 ? 'text-green-600' : cert.percentage >= 80 ? 'text-blue-600' : cert.percentage >= 70 ? 'text-yellow-600' : 'text-orange-600';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Certificate preview */}
      <div
        ref={printRef}
        className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 relative overflow-hidden"
      >
        <div className="absolute inset-2 border border-yellow-400/30 rounded pointer-events-none" />
        <div className="absolute top-3 right-3 opacity-10">
          <Trophy className="h-20 w-20 text-yellow-400" />
        </div>
        <div className="relative z-10">
          <p className="text-xs tracking-widest text-yellow-400/80 uppercase mb-2">Certificate of Achievement</p>
          <p className="text-xs text-white/60 mb-1">SSC Online Examination Platform</p>
          <h3 className="text-base font-bold leading-snug mb-3 text-white">{cert.examTitle}</h3>
          <div className="flex gap-4">
            <div>
              <p className={`text-2xl font-bold ${gradeColor.replace('text-', 'text-')}`} style={{color:'#facc15'}}>{cert.percentage.toFixed(1)}%</p>
              <p className="text-xs text-white/60">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{grade}</p>
              <p className="text-xs text-white/60">Grade</p>
            </div>
            {cert.rank && (
              <div>
                <p className="text-2xl font-bold text-yellow-400">#{cert.rank}</p>
                <p className="text-xs text-white/60">Rank</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Issued on</p>
            <p className="text-sm font-medium">{new Date(cert.date).toLocaleDateString()}</p>
          </div>
          <Button size="sm" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Certificates() {
  const { user } = useAuth();
  const { data: resultsData, isLoading } = useListResults({ query: { limit: 100 } } as any);

  const results = (resultsData as any)?.data ?? [];

  const certs: CertificateData[] = results
    .filter((r: any) => {
      const pct = (r.score / r.totalMarks) * 100;
      return pct >= CERTIFICATE_THRESHOLD;
    })
    .map((r: any) => ({
      id: r.id,
      examTitle: r.examTitle ?? `Exam #${r.examId}`,
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: (r.score / r.totalMarks) * 100,
      accuracy: r.accuracy,
      rank: r.rank ?? null,
      date: r.createdAt,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Award className="h-8 w-8 text-primary" />
          My Certificates
        </h1>
        <p className="text-muted-foreground mt-1">
          Certificates are awarded for scoring 60% or above in any exam
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Award className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{certs.length}</p>
              <p className="text-xs text-muted-foreground">Certificates Earned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Star className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {certs.filter(c => c.percentage >= 90).length}
              </p>
              <p className="text-xs text-muted-foreground">With Distinction (90%+)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{results.length}</p>
              <p className="text-xs text-muted-foreground">Total Tests Taken</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Certificates Yet</h3>
            <p className="text-muted-foreground mb-6">
              Score 60% or above in any exam to earn your first certificate.
            </p>
            <Button onClick={() => window.location.href = '/exams'}>Browse Exams</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map(cert => (
            <CertificateCard key={cert.id} cert={cert} userName={user?.name ?? 'Student'} />
          ))}
        </div>
      )}
    </div>
  );
}
