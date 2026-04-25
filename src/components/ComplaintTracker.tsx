import React, { useEffect, useState } from 'react';
import { getComplaints, ComplaintRecord, updateComplaintStatus, saveNotification, updateComplaintContent } from '../lib/db';
import { format } from 'date-fns';
import { CheckCircle2, Clock, X, Send, BadgeCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ComplaintTracker({ language = 'English' }: { language?: 'English' | 'Amharic' }) {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendFollowUp = () => {
    if (!selectedComplaint) return;
    setIsSending(true);
    
    // Save any edits to the message before sending
    updateComplaintContent(selectedComplaint.id, selectedComplaint.generatedMessage, selectedComplaint.followUpMessage);
    
    // Simulate slight delay
    setTimeout(() => {
      saveNotification({
        id: crypto.randomUUID(),
        complaintId: selectedComplaint.id,
        message: selectedComplaint.followUpMessage,
        timestamp: new Date().toISOString(),
        read: false
      });
      setIsSending(false);
      alert(language === 'English' ? 'Follow-up sent to user!' : 'መልዕክቱ ለተጠቃሚው ተልኳል!');
    }, 500);
  };

  const handleCloseModal = () => {
    if (selectedComplaint) {
      updateComplaintContent(selectedComplaint.id, selectedComplaint.generatedMessage, selectedComplaint.followUpMessage);
    }
    setSelectedComplaint(null);
  };

  const loadData = () => {
    setComplaints(getComplaints().filter(c => c.status !== 'Resolved'));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('complaints_updated', loadData);
    return () => window.removeEventListener('complaints_updated', loadData);
  }, []);

  const handleStatusChange = (id: string, newStatus: ComplaintRecord['status']) => {
    updateComplaintStatus(id, newStatus);
  };

  if (complaints.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
        <p>{language === 'English' ? 'No complaints saved yet.' : 'እስካሁን ምንም ቅሬታ አልተመዘገበም::'}</p>
        <p className="text-sm mt-2">{language === 'English' ? 'Go to Submit Complaint to record an issue.' : 'ቅሬታ ለማስመዝገብ ቅሬታ ያቅረቡ የሚለውን ይምረጡ::'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{language === 'English' ? 'Complaint Tracker' : 'የቅሬታ መከታተያ'}</h2>
          <p className="text-sm text-gray-500 mt-1">{language === 'English' ? 'Manage and update submitted citizen issues.' : 'የቀረቡ የዜጎችን ቅሬታዎች ያስተዳድሩ እና ያሻሽሉ።'}</p>
        </div>
        <div className="flex bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm items-center gap-2 text-sm font-medium text-gray-600">
          <Clock className="w-4 h-4 text-blue-500" />
          <span>{complaints.length} {language === 'English' ? 'Records' : 'መዛግብት'}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">{language === 'English' ? 'Date & Time' : 'ቀን እና ሰዓት'}</th>
                <th className="px-6 py-4 font-bold">{language === 'English' ? 'Area' : 'አካባቢ'}</th>
                <th className="px-6 py-4 font-bold">{language === 'English' ? 'Issue / Utility' : 'ችግር / አገልግሎት'}</th>
                <th className="px-6 py-4 font-bold">{language === 'English' ? 'Priority' : 'ቅድሚያ'}</th>
                <th className="px-6 py-4 font-bold">{language === 'English' ? 'Status' : 'ሁኔታ'}</th>
                <th className="px-6 py-4 font-bold text-right">{language === 'English' ? 'Actions' : 'ድርጊቶች'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {complaints.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium font-mono text-xs">
                    {format(new Date(c.timestamp), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 text-sm">
                    {c.area}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{c.utilityType}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1" title={c.category}>{c.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-2">
                    <span className={cn(
                      "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                      c.urgency === 'Emergency' ? 'bg-red-100 text-red-800' :
                      c.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                      c.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    )}>
                      {c.urgency}
                    </span>
                    {c.verified && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 border border-green-200 rounded-md">
                        <BadgeCheck className="w-3 h-3" />
                        {language === 'English' ? 'Verified (' + (c.reportCount || 0) + ')' : 'ተረጋግጧል (' + (c.reportCount || 0) + ')'}
                      </span>
                    )}
                    {!c.verified && (c.reportCount || 1) > 1 && (
                      <span className="text-[10px] text-gray-500 font-medium">
                        {c.reportCount} {language === 'English' ? 'reports' : 'ሪፖርቶች'}
                      </span>
                    )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select 
                      className={cn(
                        "text-xs font-bold rounded-full px-3 py-1 border-none bg-gray-100 focus:ring-0 cursor-pointer outline-none appearance-none font-sans",
                        c.status === 'New' && "bg-gray-100 text-gray-700",
                        c.status === 'Reported' && "bg-blue-100 text-blue-700",
                        c.status === 'Followed Up' && "bg-purple-100 text-purple-700",
                        c.status === 'Resolved' && "bg-green-100 text-green-800"
                      )}
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value as any)}
                    >
                      <option value="New">{language === 'English' ? 'New' : 'አዲስ'}</option>
                      <option value="Reported">{language === 'English' ? 'Reported' : 'ሪፖርት ተደርጓል'}</option>
                      <option value="Followed Up">{language === 'English' ? 'Followed Up' : 'ክትትል ተደርጓል'}</option>
                      <option value="Resolved">{language === 'English' ? 'Resolved' : 'ተፈትቷል'}</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => setSelectedComplaint(c)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {language === 'English' ? 'View Msgs' : 'መልዕክት'}
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{language === 'English' ? 'Complaint Details' : 'የቅሬታ ዝርዝሮች'}</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">{language === 'English' ? 'Generated Complaint' : 'የተዘጋጀው ቅሬታ'}</h4>
                <p className="text-xs text-gray-500 mb-2">{language === 'English' ? 'You can edit this message before using it.' : 'ይህን መልዕክት ከመጠቀምዎ በፊት ማስተካከል ይችላሉ።'}</p>
                <textarea
                  value={selectedComplaint.generatedMessage}
                  onChange={(e) => setSelectedComplaint({ ...selectedComplaint, generatedMessage: e.target.value })}
                  className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 font-serif focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[120px]"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-900">{language === 'English' ? 'Suggested Follow-Up' : 'ለክትትል የተዘጋጀ'}</h4>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">{language === 'English' ? 'Editable' : 'ሊስተካከል የሚችል'}</span>
                </div>
                <textarea
                  value={selectedComplaint.followUpMessage}
                  onChange={(e) => setSelectedComplaint({ ...selectedComplaint, followUpMessage: e.target.value })}
                  className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 font-serif focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[120px]"
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3">{language === 'English' ? 'Original User Description' : 'የተጠቃሚው ማብራሪያ'}</h4>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedComplaint.originalText}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
              <button 
                onClick={handleSendFollowUp}
                disabled={isSending}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSending ? (language === 'English' ? 'Sending...' : 'እየላከ ነው...') : (language === 'English' ? 'Send Follow-Up to User' : 'መልዕክቱን ለተጠቃሚው ላክ')}
              </button>
              <button 
                onClick={handleCloseModal}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
              >
                {language === 'English' ? 'Close' : 'ዝጋ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
