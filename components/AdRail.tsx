export function AdRail() {
  return (
    <aside className="ad-rail" aria-label="Advertisement">
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
      <div className="ad-slot">
        <span className="ad-label">Advertisement</span>
        <div className="ad-slot-placeholder">Iklan</div>
      </div>
    </aside>
  );
}
