export function AdRail() {
  return (
    <aside
      className="relative mb-4 flex w-full items-center justify-center overflow-hidden border border-border-soft bg-panel"
      aria-label="Advertisement"
    >
      {/*
        ============================================================
        IKLAN KIRI (rail) — tempel tag jaringan iklan Anda di sini.

        Lebar diatur lewat `--ad-rail-width` di app/globals.css (default 20%,
        konten 80%). Untuk unit responsif (AdSense "auto") biarkan 20%; untuk
        unit berukuran tetap, set `--ad-rail-width` ke px yang cocok:
          • 160px  → skyscraper 160×600
          • 300px  → medium-rect 300×250 / half-page 300×600

        Contoh Google AdSense (responsif):
          <ins className="adsbygoogle"
               style={{ display: 'block' }}
               data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
               data-ad-slot="XXXXXXXXXX"
               data-ad-format="auto"
               data-full-width-responsive="true" />

        Contoh Adsterra:
          <div id="container-XXXXXXXXXX" /> + tag <script> Adsterra-nya
        ============================================================
      */}
      <div className="flex w-full flex-col items-center justify-center">
        <span className="absolute left-2.5 top-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted opacity-65">
          Advertisement
        </span>
        <div className="flex h-[600px] w-full items-center justify-center text-sm text-muted">Iklan</div>
      </div>
    </aside>
  );
}
