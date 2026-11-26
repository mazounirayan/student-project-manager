import PDFDocument from 'pdfkit';
import { Defense, Group, Report, ReportSection, ReportSectionConfig } from '../entities/Entities';

const MARGIN = 50;

function render(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    build(doc);
    doc.end();
  });
}

/** Rend le contenu HTML d'une section éditée en texte brut. */
function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class PDFGeneratorService {
  static generateDefenseSchedule(defenses: Defense[], projectName: string): Promise<Buffer> {
    return render(doc => {
      doc.fontSize(20).text(`Planning des soutenances - ${projectName}`);
      doc.fontSize(10).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`).moveDown();

      for (const defense of defenses) {
        const day = defense.startTime.toLocaleDateString('fr-FR');
        const time = `${defense.startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${defense.endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        doc.fontSize(11).text(`${defense.orderIndex}. ${defense.group.name}  |  ${day}  |  ${time}  |  ${defense.location || 'Lieu à définir'}`);
      }
    });
  }

  static generateAttendanceSheet(groups: Group[], projectName: string, orderType: 'group' | 'alphabetical'): Promise<Buffer> {
    const rows = groups.flatMap(group => group.members.map(student => ({ student, groupName: group.name })));
    rows.sort((a, b) => orderType === 'alphabetical'
      ? a.student.lastName.localeCompare(b.student.lastName)
      : a.groupName.localeCompare(b.groupName) || a.student.lastName.localeCompare(b.student.lastName));

    return render(doc => {
      doc.fontSize(20).text(`Feuille d'émargement - ${projectName}`);
      doc.fontSize(10).text(`Ordre : ${orderType === 'group' ? 'par groupe' : 'alphabétique'}`).moveDown();

      for (const { student, groupName } of rows) {
        const y = doc.y;
        doc.fontSize(10).text(`${student.lastName} ${student.firstName}`, MARGIN, y, { width: 200 });
        doc.text(groupName, 260, y, { width: 100 });
        doc.moveTo(380, y + 12).lineTo(540, y + 12).stroke();
        doc.moveDown(0.8);
      }
    });
  }

  static generateReport(report: Report, sections: ReportSectionConfig[], contents: ReportSection[]): Promise<Buffer> {
    return render(doc => {
      doc.fontSize(20).text(report.title);
      doc.fontSize(10).text(`Groupe : ${report.group.name}`).moveDown();

      for (const section of [...sections].sort((a, b) => a.orderIndex - b.orderIndex)) {
        const content = contents.find(item => item.sectionConfig.id === section.id)?.content ?? '';
        doc.fontSize(14).text(section.title).moveDown(0.3);
        doc.fontSize(11).text(htmlToText(content) || '(section vide)').moveDown();
      }
    });
  }
}
