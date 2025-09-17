import jsPDF from "jspdf";

export default function ReportScreen({ report }) {
  const downloadReport = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Final Proctoring Report", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    let y = 40;

    doc.text(`Candidate: ${report.candidateName}`, 20, y);
    y += 10;
    doc.text(`Start Time: ${report.startTime}`, 20, y);
    y += 10;
    doc.text(`End Time: ${report.endTime}`, 20, y);
    y += 10;
    doc.text(`Duration: ${report.duration}`, 20, y);
    y += 10;
    doc.text(`Focus Lost: ${report.focusLost}`, 20, y);
    y += 10;
    doc.text(`Multiple Faces: ${report.multipleFaces}`, 20, y);
    y += 10;
    doc.text(`Suspicious Items: ${report.suspiciousItems}`, 20, y);
    y += 10;
    doc.text(`Final Integrity Score: ${report.integrityScore}`, 20, y);

    doc.save(`${report.candidateName}_Proctoring_Report.pdf`);
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl text-left">
      <h2 className="text-2xl font-bold mb-4">Final Proctoring Report</h2>
      <div className="space-y-2 text-gray-200">
        <p><strong className="text-white">Candidate:</strong> {report.candidateName}</p>
        <p><strong className="text-white">Start:</strong> {report.startTime}</p>
        <p><strong className="text-white">End:</strong> {report.endTime}</p>
        <p><strong className="text-white">Duration:</strong> {report.duration}</p>
        <p><strong className="text-white">Focus Lost:</strong> {report.focusLost}</p>
        <p><strong className="text-white">Multiple Faces:</strong> {report.multipleFaces}</p>
        <p><strong className="text-white">Suspicious Items:</strong> {report.suspiciousItems}</p>
        <p><strong className="text-white">Final Integrity Score:</strong> 
          <span className="text-green-400"> {report.integrityScore}</span>
        </p>
      </div>

      <button
        onClick={downloadReport}
        className="mt-6 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:scale-105 transform transition shadow-lg"
      >
        ⬇️ Download Report
      </button>
    </div>
  );
}
