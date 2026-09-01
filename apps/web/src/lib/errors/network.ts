/**
 * Deteksi dan mapping error jaringan level transport (fetch reject).
 *
 * Digunakan di halaman login/register untuk mengubah pesan mentah
 * `Failed to fetch` menjadi panduan ramah bahasa Indonesia.
 */

const NETWORK_MESSAGE_PATTERN = /failed to fetch|network request failed|networkerror|load failed/i

export function isNetworkError(err: unknown): boolean {
  if (err == null) return false

  // Native fetch throws TypeError untuk transport failure
  if (err instanceof TypeError && NETWORK_MESSAGE_PATTERN.test(err.message)) {
    return true
  }

  // Object dengan name / message (AuthError, AuthRetryableFetchError, dll.)
  if (typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown }
    if (typeof e.name === 'string' && e.name === 'AuthRetryableFetchError') return true
    if (typeof e.message === 'string' && NETWORK_MESSAGE_PATTERN.test(e.message)) return true
  }

  return false
}

export const NETWORK_ERROR_MESSAGE =
  'Gangguan koneksi terdeteksi. Silakan periksa koneksi internet Anda, nonaktifkan sementara ekstensi browser/ad-blocker/VPN, lalu refresh halaman. Jika masih bermasalah, coba gunakan jaringan atau device lain.'

export const PARTIAL_SIGNUP_MESSAGE =
  'Akun Anda sudah berhasil dibuat, namun pembuatan organisasi gagal karena gangguan jaringan. Silakan login kembali untuk melanjutkan, atau coba daftar ulang jika akun belum aktif.'

export function logNetworkError(op: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[network-error][${op}]`, err)
}
