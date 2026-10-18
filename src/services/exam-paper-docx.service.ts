/**
 * SMART ABSENSI GURU — EXAM PAPER & KISI-KISI DOCX GENERATOR
 * Sesuai format resmi KOP SOAL SMPT AL-ITTIHADIYAH SEMESTER GANJIL T.A 2026-2027
 */
import { KOP_LOGO_BASE64 } from '../assets/kop-logo.base64';

export interface McqQuestionItem {
  number: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  topic?: string;
  indicator?: string;
  cognitiveLevel?: string;
}

export interface EssayQuestionItem {
  number: number;
  question: string;
  expectedAnswer: string;
  maxScore: number;
  topic?: string;
  indicator?: string;
  cognitiveLevel?: string;
}

export interface ExamPaperData {
  institutionName: string;
  foundationName: string;
  examType: 'ASTS' | 'ASAS' | 'ULANGAN_HARIAN' | string;
  examTypeLabel: string;
  semester: 'GANJIL' | 'GENAP';
  academicYear: string;
  subject: string;
  gradeClass: string;
  category: 'EKSAK' | 'NON_EKSAK';
  durationMinutes: number;
  examDate?: string;
  teacherName?: string;
  mcqQuestions: McqQuestionItem[];
  essayQuestions: EssayQuestionItem[];
}

export class ExamPaperDocxService {
  /**
   * Generates official Word HTML document for Exam Question Paper with SMPT Al-Ittihadiyah Header
   */
  public static generateExamPaperWordHtml(data: ExamPaperData): string {
    const {
      institutionName,
      semester,
      academicYear,
      subject,
      gradeClass,
      mcqQuestions,
      essayQuestions,
    } = data;

    const isASTS = data.examType === 'ASTS';
    const examHeadingLine1 = isASTS
      ? `ASESMEN SUMATIF TENGAH SEMESTER (ASTS) ${semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`
      : `ASESMEN SUMATIF AKHIR SEMESTER (ASAS) ${semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`;
    const semesterRomawi = semester === 'GANJIL' ? 'Semester I' : 'Semester II';

    // Lembar Jawaban Siswa Grid 4 Kolom x 10 Baris (1..40)
    let gridRows = '';
    for (let r = 1; r <= 10; r++) {
      gridRows += '<tr>';
      const colStarts = [r, r + 10, r + 20, r + 30];
      colStarts.forEach((num) => {
        gridRows += `
          <td style="width: 4%; text-align: center; font-weight: bold; border: 1pt solid #000; padding: 1.5pt 0; font-size: 9.5pt; background-color: #fafafa;">${num}</td>
          <td style="width: 5.25%; text-align: center; border: 1pt solid #000; padding: 1.5pt 0; font-size: 9.5pt;">A</td>
          <td style="width: 5.25%; text-align: center; border: 1pt solid #000; padding: 1.5pt 0; font-size: 9.5pt;">B</td>
          <td style="width: 5.25%; text-align: center; border: 1pt solid #000; padding: 1.5pt 0; font-size: 9.5pt;">C</td>
          <td style="width: 5.25%; text-align: center; border: 1pt solid #000; padding: 1.5pt 0; font-size: 9.5pt;">D</td>
        `;
      });
      gridRows += '</tr>';
    }

    let essayAnswerBoxes = '';
    for (let e = 1; e <= Math.max(5, essayQuestions.length); e++) {
      essayAnswerBoxes += `
        <table style="width: 100%; border-collapse: collapse; border: 1pt solid #000; margin-bottom: 5pt; font-family: 'Times New Roman', Times, serif;">
          <tr>
            <td style="width: 22pt; font-weight: bold; border-right: 1pt solid #000; vertical-align: top; padding: 3pt; text-align: center; background-color: #f7f7f7; font-size: 10pt;">${e}</td>
            <td style="height: 34pt; vertical-align: top; padding: 3pt;"></td>
          </tr>
        </table>
      `;
    }

    const mcqHtml = mcqQuestions
      .map(
        (q) => `
        <div class="question-item" style="margin-bottom: 11pt; page-break-inside: avoid; break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt;">
            <tr>
              <td style="width: 22pt; vertical-align: top; font-weight: bold; font-family: 'Times New Roman', Times, serif;">${q.number}.</td>
              <td style="vertical-align: top; text-align: justify; line-height: 1.35; font-family: 'Times New Roman', Times, serif;">${q.question}</td>
            </tr>
          </table>
          <table style="width: 100%; margin-left: 22pt; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; margin-top: 3pt;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding: 1.5pt 0; font-family: 'Times New Roman', Times, serif;"><span style="font-weight: bold;">A.</span> ${q.options.A}</td>
              <td style="width: 50%; vertical-align: top; padding: 1.5pt 0; font-family: 'Times New Roman', Times, serif;"><span style="font-weight: bold;">B.</span> ${q.options.B}</td>
            </tr>
            <tr>
              <td style="width: 50%; vertical-align: top; padding: 1.5pt 0; font-family: 'Times New Roman', Times, serif;"><span style="font-weight: bold;">C.</span> ${q.options.C}</td>
              <td style="width: 50%; vertical-align: top; padding: 1.5pt 0; font-family: 'Times New Roman', Times, serif;"><span style="font-weight: bold;">D.</span> ${q.options.D}</td>
            </tr>
          </table>
        </div>
      `
      )
      .join('');

    const essayHtml = essayQuestions
      .map(
        (q) => `
        <div style="margin-bottom: 12pt; page-break-inside: avoid; break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt;">
            <tr>
              <td style="width: 22pt; vertical-align: top; font-weight: bold; font-family: 'Times New Roman', Times, serif;">${q.number}.</td>
              <td style="vertical-align: top; text-align: justify; line-height: 1.35; font-family: 'Times New Roman', Times, serif;">
                ${q.question}
                <span style="font-size: 9.5pt; color: #444; font-style: italic; font-family: 'Times New Roman', Times, serif;"> (Skor Maks: ${q.maxScore})</span>
              </td>
            </tr>
          </table>
        </div>
      `
      )
      .join('');

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <title>Naskah Soal - ${subject} Kelas ${gradeClass}</title>
        <style>
          @page Section1 {
            size: 210mm 297mm; /* A4 Portrait */
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
          }
          div.Section1 { page: Section1; }
          body, p, div, table, td, th, span, h1, h2, h3, h4, ol, li {
            font-family: 'Times New Roman', Times, serif !important;
            color: #000000;
          }
          body {
            font-size: 10.5pt;
            line-height: 1.3;
            background: #ffffff;
          }
          .two-columns-section {
            column-count: 2;
            -webkit-column-count: 2;
            -moz-column-count: 2;
            column-gap: 22pt;
            column-rule: 0.75pt solid #c5c5c5;
            text-align: justify;
          }
          .question-item {
            page-break-inside: avoid;
            break-inside: avoid;
            display: inline-block;
            width: 100%;
          }
          h1, h2, h3 {
            margin: 0;
            padding: 0;
            text-align: center;
          }
          .kop-border {
            border-top: 2.5pt solid #000000;
            border-bottom: 1pt solid #000000;
            height: 3pt;
            margin: 6pt 0 10pt 0;
          }
          .table-meta {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-bottom: 10pt;
            font-family: 'Times New Roman', serif;
          }
          .table-meta td {
            padding: 2pt 4pt;
            vertical-align: top;
          }
          .section-title {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 14pt;
            margin-bottom: 6pt;
            padding-bottom: 2pt;
            border-bottom: 1pt solid #000000;
          }
          .instructions-box {
            border: 1pt solid #000000;
            padding: 6pt 8pt;
            font-size: 9.5pt;
            margin-bottom: 12pt;
            background-color: #fbfbfb;
          }
          .instructions-box ol {
            margin: 2pt 0 2pt 16pt;
            padding: 0;
          }
          .instructions-box li {
            margin-bottom: 2pt;
          }
          @media print {
            @page {
              size: A4 portrait;
              margin: 1.5cm;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .two-columns-section {
              column-count: 2 !important;
              -webkit-column-count: 2 !important;
              column-gap: 22pt !important;
              column-rule: 0.75pt solid #c5c5c5 !important;
              text-align: justify !important;
            }
            .question-item {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: inline-block !important;
              width: 100% !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <!-- ── KOP RESMI PERSIS SESUAI BERKAS FILE KOP SOAL SMPT AL-ITTIHADIYAH ── -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt; border: none;">
            <tr>
              <td style="width: 65pt; vertical-align: middle; text-align: left; padding: 0;">
                <img src="${KOP_LOGO_BASE64}" alt="Logo" style="width: 54pt; height: 54pt; object-fit: contain;" />
              </td>
              <td style="vertical-align: middle; text-align: center; padding: 0 4pt;">
                <h1 style="margin: 0; font-size: 13pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; text-transform: uppercase; line-height: 1.25;">
                  ${examHeadingLine1}
                </h1>
                <h2 style="margin: 2pt 0; font-size: 13pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; text-transform: uppercase; line-height: 1.25;">
                  ${institutionName}
                </h2>
                <h3 style="margin: 0; font-size: 13pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; text-transform: uppercase; line-height: 1.25;">
                  TAHUN ${academicYear}
                </h3>
              </td>
              <td style="width: 65pt; vertical-align: middle; padding: 0;"></td>
            </tr>
          </table>

          <!-- ── TABEL METADATA UJIAN PERSIS SESUAI BERKAS FILE ── -->
          <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin-bottom: 10pt; border: none;">
            <tr>
              <td style="width: 18%; font-weight: bold; padding: 2.5pt 0;">Mata Pelajaran</td>
              <td style="width: 32%; font-weight: bold; padding: 2.5pt 0;">: ${subject}</td>
              <td style="width: 18%; font-weight: bold; padding: 2.5pt 0;">Nama Siswa</td>
              <td style="width: 32%; padding: 2.5pt 0;">: ........................................</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 2.5pt 0;">Kelas/ Semester</td>
              <td style="font-weight: bold; padding: 2.5pt 0;">: Kelas ${gradeClass}/${semesterRomawi}</td>
              <td style="font-weight: bold; padding: 2.5pt 0;">Hari/ Tanggal</td>
              <td style="padding: 2.5pt 0;">: ........................................</td>
            </tr>
          </table>

          <!-- ── BAGIAN I: PILIHAN GANDA ── -->
          <h4 style="margin: 8pt 0 4pt 0; font-size: 11.5pt; font-weight: bold; font-family: 'Times New Roman', Times, serif;">
            Pilihan Ganda
          </h4>

          <div class="two-columns-section">
            ${mcqHtml}
          </div>

          <!-- ── BAGIAN II: ESSAY ── -->
          <h4 style="margin: 14pt 0 4pt 0; font-size: 11.5pt; font-weight: bold; font-family: 'Times New Roman', Times, serif;">
            Essay
          </h4>

          <div>
            ${essayHtml}
          </div>

          <!-- ── LEMBAR JAWABAN SISWA (SESUAI BERKAS FILE DOCX) ── -->
          <div style="page-break-before: always; margin-top: 16pt;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt; border: none;">
              <tr>
                <td style="width: 55pt; vertical-align: middle; text-align: left; padding: 0;">
                  <img src="${KOP_LOGO_BASE64}" alt="Logo" style="width: 46pt; height: 46pt; object-fit: contain;" />
                </td>
                <td style="vertical-align: middle; text-align: center; padding: 0 4pt;">
                  <h2 style="margin: 0; font-size: 12pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; text-transform: uppercase;">
                    ${examHeadingLine1} — LEMBAR JAWABAN
                  </h2>
                  <h3 style="margin: 2pt 0 0 0; font-size: 11pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; text-transform: uppercase;">
                    ${institutionName} • TAHUN ${academicYear}
                  </h3>
                </td>
                <td style="width: 55pt;"></td>
              </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 10pt; margin-bottom: 8pt; border: none;">
              <tr>
                <td style="width: 16%; font-weight: bold; padding: 2pt 0;">Mata Pelajaran</td>
                <td style="width: 34%; padding: 2pt 0;">: ${subject}</td>
                <td style="width: 16%; font-weight: bold; padding: 2pt 0;">Nama Siswa</td>
                <td style="width: 34%; padding: 2pt 0;">: ........................................</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 2pt 0;">Kelas/ Semester</td>
                <td style="padding: 2pt 0;">: Kelas ${gradeClass}/${semesterRomawi}</td>
                <td style="font-weight: bold; padding: 2pt 0;">Hari/ Tanggal</td>
                <td style="padding: 2pt 0;">: ........................................</td>
              </tr>
            </table>

            <h4 style="margin: 6pt 0 4pt 0; font-size: 11pt; font-weight: bold; font-family: 'Times New Roman', Times, serif;">
              Pilihan Ganda
            </h4>

            <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; margin-bottom: 8pt;">
              <thead>
                <tr>
                  <th colspan="20" style="text-align: left; padding: 3pt 4pt; border: 1pt solid #000; background-color: #f0f0f0; font-size: 9.5pt;">
                    Nama : ............................................................................
                  </th>
                </tr>
              </thead>
              <tbody>
                ${gridRows}
              </tbody>
            </table>

            <h4 style="margin: 10pt 0 4pt 0; font-size: 11pt; font-weight: bold; font-family: 'Times New Roman', Times, serif;">
              Essay
            </h4>
            ${essayAnswerBoxes}
          </div>

          <!-- Footer Cetak -->
          <div style="margin-top: 16pt; text-align: center; font-size: 9pt; font-style: italic; color: #555; border-top: 0.5pt dashed #aaa; padding-top: 6pt;">
            *** Selamat Mengerjakan &amp; Semoga Sukses — Kejujuran Adalah Kunci Keberkahan ***
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates official Word HTML document for Kunci Jawaban & Kisi-Kisi Asesmen
   */
  public static generateAnswerKeyAndKisiKisiWordHtml(data: ExamPaperData): string {
    const {
      foundationName,
      institutionName,
      examTypeLabel,
      semester,
      academicYear,
      subject,
      gradeClass,
      category,
      mcqQuestions,
      essayQuestions,
    } = data;

    const semesterText = semester === 'GANJIL' ? 'SEMESTER GANJIL' : 'SEMESTER GENAP';

    // Tabel Kunci Jawaban PG (grid 5 kolom x rows)
    const mcqKeyRows: string[] = [];
    const chunkSize = 5;
    for (let i = 0; i < mcqQuestions.length; i += chunkSize) {
      const chunk = mcqQuestions.slice(i, i + chunkSize);
      const cells = chunk
        .map(
          (q) => `
          <td style="border: 1pt solid #000; padding: 4pt 6pt; text-align: center; width: 20%;">
            <strong style="font-size: 10pt;">${q.number}.</strong>
            <span style="font-size: 12pt; font-weight: bold; color: #023246; margin-left: 3pt;">${q.correctAnswer}</span>
          </td>
        `
        )
        .join('');
      mcqKeyRows.push(`<tr>${cells}</tr>`);
    }

    // Tabel Rubrik Essay
    const essayRubricRows = essayQuestions
      .map(
        (q) => `
        <tr>
          <td style="border: 1pt solid #000; padding: 4pt; text-align: center; font-weight: bold; width: 6%;">${q.number}</td>
          <td style="border: 1pt solid #000; padding: 4pt; font-size: 10pt; line-height: 1.3; width: 44%;">${q.question}</td>
          <td style="border: 1pt solid #000; padding: 4pt; font-size: 10pt; line-height: 1.3; width: 40%;">${q.expectedAnswer}</td>
          <td style="border: 1pt solid #000; padding: 4pt; text-align: center; font-weight: bold; width: 10%;">${q.maxScore}</td>
        </tr>
      `
      )
      .join('');

    // Tabel Kisi-Kisi Soal (Standar Kurikulum Merdeka)
    let kisiKisiIndex = 1;
    const mcqKisiKisiRows = mcqQuestions
      .map(
        (q) => `
        <tr>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">${kisiKisiIndex++}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; font-size: 9.5pt;">${q.topic || `Materi Pokok ${subject}`}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; font-size: 9.5pt;">${q.indicator || `Disajikan stimulus, siswa dapat menyelesaikan permasalahan terkait ${subject}`}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">${q.cognitiveLevel || 'L2 (C3)'}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">Pilihan Ganda</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-weight: bold; font-size: 9.5pt;">${q.number}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-weight: bold; font-size: 9.5pt;">${q.correctAnswer}</td>
        </tr>
      `
      )
      .join('');

    const essayKisiKisiRows = essayQuestions
      .map(
        (q) => `
        <tr>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">${kisiKisiIndex++}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; font-size: 9.5pt;">${q.topic || `Materi Pokok ${subject}`}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; font-size: 9.5pt;">${q.indicator || `Siswa dapat menguraikan dan menjelaskan secara komprehensif terkait ${subject}`}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">${q.cognitiveLevel || 'L3 (C4-C5)'}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">Uraian / Essay</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-weight: bold; font-size: 9.5pt;">${q.number}</td>
          <td style="border: 1pt solid #000; padding: 3pt 4pt; text-align: center; font-size: 9.5pt;">Rubrik (${q.maxScore})</td>
        </tr>
      `
      )
      .join('');

    const pgWeightText = category === 'EKSAK' ? '60%' : '70%';
    const essayWeightText = category === 'EKSAK' ? '40%' : '30%';

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Kunci Jawaban & Kisi-Kisi - ${subject} Kelas ${gradeClass}</title>
        <style>
          @page Section1 {
            size: 210mm 297mm; /* A4 Portrait */
            margin: 1.8cm 1.8cm 1.8cm 1.8cm;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000000;
            line-height: 1.25;
            background: #ffffff;
          }
          .table-bordered {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6pt;
            margin-bottom: 12pt;
          }
          .table-bordered th {
            border: 1pt solid #000000;
            background-color: #f2f2f2;
            padding: 4pt;
            font-size: 9.5pt;
            font-weight: bold;
            text-align: center;
          }
          .table-bordered td {
            border: 1pt solid #000000;
            padding: 3pt 4pt;
          }
          .section-heading {
            font-size: 12pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 14pt;
            margin-bottom: 4pt;
            border-bottom: 1.5pt solid #000;
            padding-bottom: 2pt;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <!-- KOP DOKUMEN -->
          <div style="text-align: center; margin-bottom: 12pt;">
            <p style="margin: 0; font-size: 10.5pt; font-weight: bold; text-transform: uppercase;">
              ${foundationName}
            </p>
            <h1 style="margin: 2pt 0; font-size: 13pt; font-weight: bold; text-transform: uppercase;">
              ${institutionName}
            </h1>
            <h2 style="margin: 4pt 0 2pt 0; font-size: 11.5pt; font-weight: bold; text-transform: uppercase;">
              KUNCI JAWABAN &amp; KISI-KISI PENILAIAN ${examTypeLabel}
            </h2>
            <p style="margin: 0; font-size: 10pt; font-weight: bold;">
              ${semesterText} • TAHUN AJARAN ${academicYear}
            </p>
            <p style="margin: 3pt 0 0 0; font-size: 10.5pt;">
              Mata Pelajaran: <strong>${subject}</strong> | Kelas: <strong>${gradeClass}</strong> | Kategori: <strong>${category === 'EKSAK' ? 'Eksak' : 'Non-Eksak'}</strong>
            </p>
            <div style="border-bottom: 2pt solid #000; margin-top: 6pt;"></div>
          </div>

          <!-- 1. KUNCI JAWABAN PILIHAN GANDA -->
          <div class="section-heading">
            1. Kunci Jawaban Pilihan Ganda (Bobot: ${pgWeightText})
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 6pt; margin-bottom: 12pt;">
            ${mcqKeyRows.join('')}
          </table>

          <!-- 2. RUBRIK PENSKORAN ESSAY -->
          ${
            essayQuestions.length > 0
              ? `
            <div class="section-heading">
              2. Pedoman Penskoran Soal Uraian / Essay (Bobot: ${essayWeightText})
            </div>
            <table class="table-bordered">
              <thead>
                <tr>
                  <th style="width: 6%;">No</th>
                  <th style="width: 44%;">Pertanyaan</th>
                  <th style="width: 40%;">Kriteria / Jawaban Diharapkan</th>
                  <th style="width: 10%;">Skor Maks</th>
                </tr>
              </thead>
              <tbody>
                ${essayRubricRows}
              </tbody>
            </table>
          `
              : ''
          }

          <!-- 3. TABEL KISI-KISI ASESMEN -->
          <div class="section-heading" style="page-break-before: auto; margin-top: 16pt;">
            3. Matriks Kisi-Kisi Asesmen (${examTypeLabel})
          </div>
          <table class="table-bordered">
            <thead>
              <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 22%;">Materi Pokok</th>
                <th style="width: 37%;">Indikator Soal</th>
                <th style="width: 12%;">Level</th>
                <th style="width: 12%;">Bentuk</th>
                <th style="width: 6%;">No Soal</th>
                <th style="width: 6%;">Kunci</th>
              </tr>
            </thead>
            <tbody>
              ${mcqKisiKisiRows}
              ${essayKisiKisiRows}
            </tbody>
          </table>

          <!-- Catatan Rumus Nilai Akhir -->
          <div style="margin-top: 12pt; font-size: 9.5pt; border: 1pt solid #000; padding: 6pt 8pt; background-color: #fafafa;">
            <strong>Rumus Penghitungan Nilai Akhir (NA):</strong>
            <p style="margin: 3pt 0 0 0; font-family: 'Courier New', monospace;">
              NA = (Total Benar PG / ${mcqQuestions.length} × 100 × ${pgWeightText}) + (Total Skor Essay / ${essayQuestions.reduce((a, b) => a + b.maxScore, 0) || 100} × 100 × ${essayWeightText})
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates formatted plain text for copying to clipboard with Microsoft Word indentation & layout
   */
  public static generatePlainTextExamPaper(data: ExamPaperData): string {
    const {
      institutionName,
      examType,
      semester,
      academicYear,
      subject,
      gradeClass,
      mcqQuestions,
      essayQuestions,
    } = data;

    const isASTS = examType === 'ASTS';
    const examHeadingLine1 = isASTS
      ? `ASESMEN SUMATIF TENGAH SEMESTER (ASTS) ${semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`
      : `ASESMEN SUMATIF AKHIR SEMESTER (ASAS) ${semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`;
    const semesterRomawi = semester === 'GANJIL' ? 'Semester I' : 'Semester II';

    const lines: string[] = [
      examHeadingLine1,
      institutionName.toUpperCase(),
      `TAHUN ${academicYear}`,
      '================================================================================',
      `Mata Pelajaran  : ${subject.padEnd(28)} Nama Siswa   : ........................................`,
      `Kelas/ Semester : Kelas ${gradeClass}/${semesterRomawi.padEnd(20)} Hari/ Tanggal : ........................................`,
      '--------------------------------------------------------------------------------',
      '',
      'Pilihan Ganda',
      '',
    ];

    mcqQuestions.forEach((q) => {
      lines.push(`${q.number}. ${q.question}`);
      lines.push(`   A. ${q.options.A}`);
      lines.push(`   B. ${q.options.B}`);
      lines.push(`   C. ${q.options.C}`);
      lines.push(`   D. ${q.options.D}`);
      lines.push('');
    });

    if (essayQuestions.length > 0) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('Essay');
      lines.push('');

      essayQuestions.forEach((eq) => {
        lines.push(`${eq.number}. ${eq.question} (Skor Maks: ${eq.maxScore})`);
        lines.push('');
      });
    }

    lines.push('================================================================================');
    lines.push('*** Selamat Mengerjakan & Semoga Sukses ***');

    return lines.join('\n');
  }

  /**
   * Triggers client-side download as Microsoft Word (.doc) file
   */
  public static downloadAsWordFile(filename: string, htmlContent: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Opens a clean print-ready popup and triggers browser print dialog for printing exam paper
   */
  public static printExamPaper(data: ExamPaperData): void {
    if (typeof window === 'undefined') return;
    const html = this.generateExamPaperWordHtml(data);
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  }
}

