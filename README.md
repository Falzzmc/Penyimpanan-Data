# RuangFile
Website penyimpanan pribadi satu akun, dengan backend Node.js + Express dan antarmuka bahasa Indonesia. File diunggah ke disk server, bukan localStorage browser. Tidak menggunakan cloud storage pihak ketiga.

## Menjalankan lokal
1. Instal Node.js 22 atau lebih baru.
2. Ekstrak ZIP, masuk ke folder proyek lewat terminal.
3. Jalankan `npm install`.
4. Salin `.env.example` menjadi `.env`.
5. Ganti APP_PASSWORD dengan password unik minimal 12 karakter. Ganti SESSION_SECRET dengan nilai acak minimal 32 karakter; buat dengan `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
6. Jalankan `node --env-file=.env server.js`.
7. Buka http://localhost:3000 dan login memakai APP_PASSWORD.

`npm start` juga bisa digunakan jika environment variables sudah disetel oleh hosting/shell. File .env tidak dibaca otomatis oleh npm start.

## Menjadikan online
Gunakan VPS atau layanan Node.js dengan persistent volume. Unggah proyek dan instal dependensi menggunakan npm install. Set environment APP_PASSWORD, SESSION_SECRET, DATA_DIR (path volume permanen), MAX_FILE_MB, NODE_ENV=production dan PORT sesuai hosting. Jalankan npm start. Pasang HTTPS menggunakan reverse proxy atau fasilitas hosting. Set TRUST_PROXY=1 hanya jika aplikasi ada tepat di belakang satu reverse proxy tepercaya; jangan mengekspos port backend secara publik dalam konfigurasi itu. Cookie produksi membutuhkan HTTPS. Sesuaikan batas ukuran unggahan dan timeout reverse proxy dengan MAX_FILE_MB.

Hosting statis saja tidak dapat menjalankan backend ini. Disk sementara/ephemeral tidak cocok: file bisa hilang saat deploy ulang. DATA_DIR tidak boleh berada di folder public atau direktori yang dilayani web server. Tidak ada layanan hosting atau domain yang otomatis dibuat oleh proyek ini.

## Fitur
- Login satu akun, logout, pembatasan percobaan login.
- Upload satu file per permintaan, maksimal 50 MB secara default.
- Daftar, cari nama file, unduh, dan konfirmasi hapus permanen.
- Total jumlah dan ukuran file (bukan indikator kapasitas disk tersedia).
- Tampilan responsif, progres unggahan, CSRF token, cookie HttpOnly/SameSite, security headers.
- Nama file ditampilkan sebagai teks dan download dipaksa sebagai lampiran. File tidak dipublikasikan lewat folder static.

## Batasan dan operasional
Ini fondasi aplikasi pribadi, bukan layanan multi-pengguna siap produksi skala besar. Semua orang yang mengetahui password mengakses kumpulan file yang sama. Tidak ada registrasi, pemulihan password, berbagi tautan publik, folder, antivirus, enkripsi at-rest, kuota total, versioning, atau tempat sampah. Jangan unggah file sensitif tanpa menambahkan kontrol keamanan yang sesuai.

Session memakai MemoryStore bawaan untuk pengujian dan penggunaan lokal; restart mengeluarkan semua pengguna. Sebelum penggunaan produksi sungguhan, ganti dengan session store persisten seperti Redis, tambahkan pemantauan kapasitas/kuota, pemindaian malware sesuai kebutuhan, dan audit keamanan. Rate limit juga lokal per proses, bukan lintas instance.

File dan metadata disimpan di DATA_DIR sebagai pasangan UUID.bin dan UUID.json. Backup seluruh direktori secara berkala dan uji pemulihannya. Data tidak terenkripsi pada disk oleh aplikasi. Upload terputus atau proses crash dapat meninggalkan file .bin tanpa metadata; periksa dan bersihkan file yatim secara berkala. Hindari menjalankan beberapa instance pada direktori yang sama tanpa menambahkan database/transaksi dan penguncian yang sesuai. Hapus tidak dapat dibatalkan. Perbarui dependensi dan audit sebelum deployment.
