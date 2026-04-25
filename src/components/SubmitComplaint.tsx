import React, { useState, useEffect } from 'react';
import { analyzeComplaint, AIAnalysisResult } from '../lib/gemini';
import { saveComplaint, ComplaintRecord, getComplaintsByAreaAndType, getComplaints, incrementReportCount } from '../lib/db';
import { AlertCircle, FileText, Send, CheckCircle2, MapPin, Clock, Twitter, Download, Phone, Activity, ThumbsUp, BadgeCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UTILITY_TYPES = [
  "Electricity",
  "Water",
  "Internet/Telecom",
  "Billing Issue",
  "Other"
];

const EMERGENCY_KEYWORDS = [
  "spark", "fire", "exploded", "explosion", "flooding", "flood",
  "exposed wire", "electric shock", "burning smell", "transformer blast",
  "sewage overflow", "contaminated water", "hazard", "danger"
];

export function SubmitComplaint({ onSubmitted, language = 'English' }: { onSubmitted: () => void, language?: string }) {
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [utilityType, setUtilityType] = useState("");
  const [timeStarted, setTimeStarted] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  
  const [relatedCount, setRelatedCount] = useState<number>(0);
  const [recentOutages, setRecentOutages] = useState<ComplaintRecord[]>([]);
  const [votedComplaints, setVotedComplaints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const votes = localStorage.getItem('ethiopia_utility_metoo_voted');
    if (votes) {
      try {
        setVotedComplaints(JSON.parse(votes));
      } catch (e) {}
    }
    
    const loadOutages = () => {
      // Get recent active complaints (not resolved)
      let all = getComplaints().filter(c => c.status !== 'Resolved');
      if (area.trim()) {
        const lowerArea = area.toLowerCase();
        all = all.filter(c => c.area.toLowerCase().includes(lowerArea) || lowerArea.includes(c.area.toLowerCase()));
      }
      setRecentOutages(all.slice(0, 5));
    };
    loadOutages();
    window.addEventListener('complaints_updated', loadOutages);
    return () => window.removeEventListener('complaints_updated', loadOutages);
  }, [area]);

  const handleMeToo = (id: string) => {
    if (votedComplaints[id]) return;
    incrementReportCount(id);
    const newVotes = { ...votedComplaints, [id]: true };
    setVotedComplaints(newVotes);
    localStorage.setItem('ethiopia_utility_metoo_voted', JSON.stringify(newVotes));
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    // Emergency Check
    const emergencyDetected = EMERGENCY_KEYWORDS.some(kw => description.toLowerCase().includes(kw));
    setIsEmergency(emergencyDetected);
    
    try {
      const aiResult = await analyzeComplaint(description, area, utilityType, timeStarted, language);
      if (emergencyDetected) {
        aiResult.urgency = 'Emergency';
      }
      setResult(aiResult);
      
      if (area) {
        const related = getComplaintsByAreaAndType(area, utilityType || aiResult.category);
        setRelatedCount(related.length);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while analyzing the complaint.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    
    const record: ComplaintRecord = {
      id: crypto.randomUUID(),
      originalText: description,
      area: area || "Unspecified",
      utilityType: utilityType || result.category,
      timeStarted: timeStarted || "Unspecified",
      category: result.category,
      urgency: result.urgency,
      generatedMessage: result.generatedMessage,
      followUpMessage: result.followUpMessage,
      status: 'New',
      timestamp: new Date().toISOString()
    };
    
    saveComplaint(record);
    
    // Reset form
    setDescription("");
    setArea("");
    setUtilityType("");
    setTimeStarted("");
    setResult(null);
    setRelatedCount(0);
    setIsEmergency(false);
    
    onSubmitted();
  };

  const handleDownloadLetter = () => {
    if (!result) return;
    const content = `Date: ${new Date().toLocaleDateString()}
Subject: Official Complaint Regarding ${result.category}

To the relevant authority,

Location: ${area || "Unspecified"}
Issue Started: ${timeStarted || "Unspecified"}
Severity: ${result.urgency}

${result.generatedMessage}

Sincerely,
[Your Name]
[Your Phone Number]
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Utility_Complaint.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  let contactInfo = {
    provider: "Local Woreda/Kebele office",
    hotline: "N/A",
    twitter: "@MayorOfAddis",
  };

  if (result) {
    const cat = result.category.toLowerCase();
    if (cat.includes("electric") || cat.includes("power")) {
      contactInfo = { provider: "EEU", hotline: "905", twitter: "@EEUEthiopia" };
    } else if (cat.includes("water")) {
      contactInfo = { provider: "AAWSA", hotline: "805 / 905", twitter: "@AAWSA_Official" };
    } else if (cat.includes("internet") || cat.includes("telecom")) {
      contactInfo = { provider: "Ethio Telecom", hotline: "994", twitter: "@ethiotelecom" };
    }
  }

  const tweetText = result ? encodeURIComponent(
    `Experiencing a ${result.category} in ${area || 'my area'}. It's been ongoing since ${timeStarted || 'a while'}. Priority: ${result.urgency}. Please assist. ${contactInfo.twitter} #Ethiopia #AddisAbaba`
  ) : '';

  const tActionHub = language === 'English' ? "Action Hub" : "ቀጣይ እርምጃዎች";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100 p-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">{language === 'English' ? 'Describe the Issue' : 'ችግሩን ይግለጹ'}</h2>
        
        <form onSubmit={handleAnalyze} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              {language === 'English' ? 'What is the problem?' : 'ችግሩ ምንድን ነው?'} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-xl border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[120px] p-4 bg-gray-50 text-gray-900"
              placeholder={language === 'English' ? "E.g. Power has been out in my area since morning." : "ለምሳሌ. ከመብራት አጥቷል..."}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{language === 'English' ? 'Area / Location' : 'አካባቢ'}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="E.g. Megenagna"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{language === 'English' ? 'Utility Type' : 'የአገልግሎት ዓይነት'}</label>
              <select
                className="w-full px-4 py-3 rounded-xl border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 appearance-none"
                value={utilityType}
                onChange={e => setUtilityType(e.target.value)}
              >
                <option value="">{language === 'English' ? 'Let AI decide' : 'AI ይምረጥ'}</option>
                {UTILITY_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{language === 'English' ? 'When did it start?' : 'መቼ ጀመረ?'}</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder={language === 'English' ? "E.g. 'Since morning', '2 hours ago'" : "ከ2 ሰዓት በፊት"}
                value={timeStarted}
                onChange={e => setTimeStarted(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !description}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold tracking-wide flex items-center justify-center transition-all shadow-sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 {language === 'English' ? 'Analyzing...' : 'በማዘጋጀት ላይ...'}
              </span>
            ) : (
              language === 'English' ? "Analyze Complaint" : "ቅሬታውን አዘጋጅ"
            )}
          </button>
          
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </form>

        {/* Live Outages Feed */}
        {recentOutages.length > 0 && (
          <div className="mt-10 pt-8 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              {language === 'English' ? 'Live Outages in Your Area' : 'በአካባቢዎ ያሉ የቀጥታ መቋረጦች'}
            </h3>
            <div className="space-y-4">
              {recentOutages.map(outage => (
                <div key={outage.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{outage.category}</span>
                      {outage.verified && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <BadgeCheck className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{new Date(outage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{outage.area}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      {outage.reportCount || 1} {language === 'English' ? 'people reported this' : 'ሰዎች ሪፖርት አድርገዋል'}
                    </span>
                    <button
                      onClick={() => handleMeToo(outage.id)}
                      disabled={votedComplaints[outage.id]}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors shadow-sm",
                        votedComplaints[outage.id] 
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {votedComplaints[outage.id] ? (language === 'English' ? 'Voted' : 'ተመዝግቧል') : (language === 'English' ? 'Me Too (+1)' : 'እኔም ላይ ደርሷል (+1)')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className={cn(
        "rounded-2xl border transition-all duration-500 overflow-hidden",
        result ? "bg-white shadow-lg border-blue-100 flex flex-col" : "bg-gray-50/50 border-gray-100 border-dashed border-2 flex items-center justify-center min-h-[400px] lg:h-full"
      )}>
        {!result ? (
          <div className="text-center p-8 text-gray-400 flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500">{language === 'English' ? 'AI Assistant Ready' : 'ለማዘጋጀት ዝግጁ ነኝ'}</p>
            <p className="text-sm max-w-xs mt-2">{language === 'English' ? 'Fill out the details on the left and click Analyze to generate your formal complaint.' : 'ዝርዝሮቹን በግራ በኩል ሞልተው ቅሬታውን አዘጋጅ የሚለውን ይጫኑ::'}</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{language === 'English' ? 'Issue Category' : 'የችግሩ ሰነድ'}</h3>
                  <p className="text-xl font-semibold text-gray-900">{result.category}</p>
                </div>
                <div className={cn(
                  "px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5",
                  result.urgency === 'Emergency' ? 'bg-red-100 text-red-800' :
                  result.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                  result.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                )}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {result.urgency} {language === 'English' ? 'Priority' : 'ቅድሚያ'}
                </div>
              </div>

              {isEmergency && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-900 text-sm shadow-sm ring-1 ring-red-100">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <strong className="block text-base mb-1">🚨 {language === 'English' ? 'EMERGENCY HAZARD DETECTED' : 'አደጋ ተከስቷል'} 🚨</strong>
                    <p>{language === 'English' ? 'Please move away from the affected area immediately. Do not touch exposed wires, flooded areas, or burning infrastructure.' : 'እባክዎ ከአደጋው አካባቢ በፍጥነት ይራቁ:: የተበጠሱ ገመዶችን ወይም የተጥለቀለቁ ቦታዎችን አይንኩ::'}</p>
                    <p className="mt-2 font-bold">{language === 'English' ? 'Contact emergency services right away: 905 for Electric / 939 for Police & Fire.' : 'ወዲያውኑ ወደ 905 (መብራት) ወይም 939 (ፖሊስ/እሳት አደጋ) ይደውሉ::'}</p>
                  </div>
                </div>
              )}
              
              {!isEmergency && relatedCount > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 text-blue-800 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p><strong>{language === 'English' ? 'Pattern detected:' : 'ተመሳሳይ ችግሮች:'}</strong> {relatedCount} {language === 'English' ? `similar complaints have been analyzed for ${area || 'this area'} recently.` : `ተመሳሳይ ቅሬታዎች በአካባቢው ሪፖርት ተደርገዋል::`}</p>
                </div>
              )}
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-0 bg-white">
              
              {/* Action Hub */}
              <div className="p-5 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl shadow-sm">
                <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  {tActionHub}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-xs text-gray-500 mb-1 font-semibold uppercase">{language === 'English' ? 'Primary Contact' : 'ዋና የመገናኛ ስልክ'}</p>
                    <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
                      <Phone className="w-4 h-4 text-green-600" />
                      {contactInfo.provider}
                    </div>
                    <p className="text-2xl font-black text-gray-900">{contactInfo.hotline}</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <a 
                      href={`https://twitter.com/intent/tweet?text=${tweetText}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="w-full px-4 py-3 bg-[#0f1419] hover:bg-[#272c30] text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Twitter className="w-4 h-4" />
                      {language === 'English' ? 'Post to X / Twitter' : 'በ X (Twitter) ላይ ይለጥፉ'}
                    </a>
                    
                    <button 
                      onClick={handleDownloadLetter}
                      className="w-full px-4 py-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {language === 'English' ? 'Download Final Letter' : 'ሙሉ ደብዳቤውን ያውርዱ'}
                    </button>
                  </div>
                </div>
              </div>

              {result.missingDetails && result.missingDetails.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    {language === 'English' ? 'Missing Details' : 'ያልተሟሉ መረጃዎች (ካሉ)'}
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    {result.missingDetails.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">{language === 'English' ? 'You can add these into the description and re-analyze, or just provide them directly to the provider.' : 'እነዚህን መረጃዎች ቢጨምሩ ሪፖርቱ ይበልጥ የተሟላ ይሆናል::'}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-500" />
                  {language === 'English' ? 'Generated Complaint Message' : 'የተዘጋጀው ደብዳቤ'}
                </h4>
                <div className="relative group">
                  <textarea
                    value={result.generatedMessage}
                    onChange={(e) => setResult({ ...result, generatedMessage: e.target.value })}
                    className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed font-serif focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[120px]"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(result.generatedMessage)}
                    className="absolute top-2 right-2 bg-white text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{language === 'English' ? 'You can edit this message to add your name or extra details.' : 'መልዕክቱን ለማስተካከል እዚህ ላይ መፃፍ ይችላሉ::'}</p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {language === 'English' ? 'Follow-up Message (Save for later)' : 'ለክትትል የሚሆን መልዕክት'}
                </h4>
                <div className="relative group">
                  <textarea
                    value={result.followUpMessage}
                    onChange={(e) => setResult({ ...result, followUpMessage: e.target.value })}
                    className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed font-serif focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y min-h-[120px]"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(result.followUpMessage)}
                    className="absolute top-2 right-2 bg-white text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0 mt-auto">
              <button
                onClick={handleSave}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                {language === 'English' ? 'Save to Tracker' : 'ወደ መከታተያ ሥርዓት ላክ'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
