/**
 * Resolves whether a student behavior log is GOOD (Kebaikan / Apresiasi / Reward)
 * or BAD (Kedisiplinan / Pelanggaran / Indisipliner) with robust semantic keyword analysis.
 *
 * Prevents misclassification where reward redemptions (e.g. "Tukar poin...")
 * or positive deeds are mistakenly classified as violations.
 */
export function resolveBehaviorLogType(
  type: string | undefined,
  reason: string | undefined,
  pointsDelta?: number
): 'GOOD' | 'BAD' {
  const r = (reason || '').toLowerCase().trim();

  // 1. Explicit exceptions: "tidak sopan" / "kurang sopan" is BAD
  if (r.includes('tidak sopan') || r.includes('kurang sopan') || r.includes('tidak santun')) {
    return 'BAD';
  }

  // 2. High-confidence GOOD deed keywords (including reward redemption like "Tukar poin")
  if (
    r.includes('tukar poin') ||
    r.includes('membantu') ||
    r.includes('aktif') ||
    r.includes('jujur') ||
    r.includes('integritas') ||
    r.includes('prestasi') ||
    r.includes('membersihkan') ||
    r.includes('merapikan') ||
    r.includes('piket') ||
    r.includes('sopan') ||
    r.includes('santun') ||
    r.includes('pengurus osis') ||
    r.includes('tutor') ||
    r.includes('tanya jawab') ||
    r.includes('berdiskusi')
  ) {
    return 'GOOD';
  }

  // 3. High-confidence BAD deed / violation keywords
  if (
    r.includes('telat') ||
    r.includes('terlambat') ||
    r.includes('bolos') ||
    r.includes('kuku') ||
    r.includes('seragam') ||
    r.includes('sepatu') ||
    r.includes('peci') ||
    r.includes('ciput') ||
    r.includes('bergo') ||
    r.includes('kerudung') ||
    r.includes('kasar') ||
    r.includes('kotor') ||
    r.includes('bercanda') ||
    r.includes('hp') ||
    r.includes('gadget') ||
    r.includes('tidak mengerjakan') ||
    r.includes('tidak sholat') ||
    r.includes('merokok') ||
    r.includes('bullying') ||
    r.includes('merusak') ||
    r.includes('mengganggu') ||
    r.includes('aksesoris') ||
    r.includes('rambut')
  ) {
    return 'BAD';
  }

  // 4. Fallback to pointsDelta if available (< 0 is GOOD in GradeMaster OS, > 0 is BAD)
  if (typeof pointsDelta === 'number') {
    return pointsDelta < 0 ? 'GOOD' : 'BAD';
  }

  return type === 'GOOD' ? 'GOOD' : 'BAD';
}
