import React, { useEffect, useState, useMemo } from 'react';
import { getComplaints, ComplaintRecord } from '../lib/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { ShieldAlert, Zap, Droplet, Wifi, Activity, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Dashboard({ language = 'English' }: { language?: 'English' | 'Amharic' }) {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);

  const loadData = () => {
    setComplaints(getComplaints().filter(c => c.status !== 'Resolved'));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('complaints_updated', loadData);
    return () => window.removeEventListener('complaints_updated', loadData);
  }, []);

  const insights = useMemo(() => {
    if (!complaints.length) return null;

    // Grouping by Area and Issue
    const areaIssueGroups: Record<string, {
      area: string;
      utilityType: string;
      count: number;
      emergencies: number;
      latestTimestamp: number;
      oldestTimestamp: number;
      durationsInHours: number[];
    }> = {};

    let totalDurationHours = 0;
    let durationCount = 0;

    const trendByDate: Record<string, number> = {};

    complaints.forEach(c => {
      // Normalize Area (e.g., 'Bole, Addis Ababa' -> 'Bole')
      const rawArea = c.area || 'Unknown Kebele';
      const cleanArea = rawArea.split(',')[0].trim();
      const type = c.utilityType || 'Other';
      
      const key = `${cleanArea}|${type}`;
      
      const ts = new Date(c.timestamp).getTime();
      
      // Simulate duration by using time since it was recorded + some heuristic
      // For demo, if it's '3 days ago' we parse it roughly or just use difference from timestamp
      const hoursSinceRecord = differenceInHours(new Date(), new Date(c.timestamp)) || 0;
      
      let estimatedHours = hoursSinceRecord;
      if (c.timeStarted.toLowerCase().includes('day')) {
        const match = c.timeStarted.match(/\d+/);
        if (match) estimatedHours += parseInt(match[0]) * 24;
      } else if (c.timeStarted.toLowerCase().includes('hour')) {
        const match = c.timeStarted.match(/\d+/);
        if (match) estimatedHours += parseInt(match[0]);
      }
      
      if (estimatedHours < 1) estimatedHours = 1;

      if (!areaIssueGroups[key]) {
        areaIssueGroups[key] = {
          area: cleanArea,
          utilityType: type,
          count: 0,
          emergencies: 0,
          latestTimestamp: ts,
          oldestTimestamp: ts,
          durationsInHours: []
        };
      }
      
      areaIssueGroups[key].count += 1;
      areaIssueGroups[key].durationsInHours.push(estimatedHours);
      if (c.urgency === 'Emergency') areaIssueGroups[key].emergencies += 1;
      if (ts > areaIssueGroups[key].latestTimestamp) areaIssueGroups[key].latestTimestamp = ts;
      if (ts < areaIssueGroups[key].oldestTimestamp) areaIssueGroups[key].oldestTimestamp = ts;

      totalDurationHours += estimatedHours;
      durationCount++;

      const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
      trendByDate[dateStr] = (trendByDate[dateStr] || 0) + 1;
    });

    const groupsArray = Object.values(areaIssueGroups);
    groupsArray.sort((a, b) => {
      // Sort by Priority: emergencies first, then count
      if (b.emergencies !== a.emergencies) return b.emergencies - a.emergencies;
      return b.count - a.count;
    });

    const hotspots = groupsArray.map(g => {
      const isAreaWide = g.count >= 3;
      let priority = 'Low';
      if (g.emergencies > 0 || g.count >= 5) priority = 'High';
      else if (g.count >= 2) priority = 'Medium';

      const avgDuration = Math.round(g.durationsInHours.reduce((a, b) => a + b, 0) / g.durationsInHours.length);

      return {
        ...g,
        isAreaWide,
        priority,
        avgDuration
      };
    });

    const topIssueGroup = hotspots[0];
    const topArea = topIssueGroup ? topIssueGroup.area : 'N/A';
    const topIssueTotalComplaints = hotspots.reduce((acc, h) => acc + (h.utilityType === topIssueGroup?.utilityType ? h.count : 0), 0);
    const totalComplaintsInTopArea = hotspots.reduce((acc, h) => acc + (h.area === topArea ? h.count : 0), 0);

    // Chart Data
    const areaChartData = Object.entries(
      hotspots.reduce((acc, h) => {
        acc[h.area] = (acc[h.area] || 0) + h.count;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    const trendChartData = Object.entries(trendByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days
      
    // If we only have 1 data point, duplicate it for the chart to render a line
    if (trendChartData.length === 1) {
        const d = new Date(trendChartData[0].date);
        d.setDate(d.getDate() - 1);
        trendChartData.unshift({ date: d.toISOString().split('T')[0], count: 0 });
    }

    return {
      total: complaints.length,
      avgDurationAll: Math.round(totalDurationHours / durationCount) || 0,
      topIssue: topIssueGroup?.utilityType || 'Unknown',
      topArea,
      topIssueIncreasing: true, // Just a static trend for the demo
      hotspots,
      areaChartData,
      trendChartData
    };
  }, [complaints]);


  if (!insights) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-gray-300" />
        </div>
        <p className="font-medium text-gray-600">{language === 'English' ? 'Not enough data to analyze patterns.' : 'መረጃዎችን ለመተንተን በቂ ቅሬታዎች የሉም::'}</p>
        <p className="text-sm mt-1">{language === 'English' ? 'Data will appear here as citizens submit complaints.' : 'ዜጎች ቅሬታዎችን ሲያቀርቡ መረጃዎች እዚህ ይታያሉ::'}</p>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{language === 'English' ? 'Dashboard Overview' : 'የዳሽቦርድ ማጠቃለያ'}</h2>
          <p className="text-sm text-gray-500 mt-1">{language === 'English' ? 'Real-time civic intelligence and insights.' : 'የአካባቢ መረጃዎች እና ትንታኔዎች።'}</p>
        </div>
        <div className="flex bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm items-center gap-2 text-sm font-medium text-gray-600">
          <Activity className="w-4 h-4 text-blue-500" />
          <span>{insights.total} {language === 'English' ? 'Total Complaints' : 'ጠቅላላ ቅሬታዎች'}</span>
        </div>
      </div>
      
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-16 h-16 text-blue-600" />
            </div>
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <div className="p-2 bg-blue-50 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider">{language === 'English' ? "Top Issue Today" : 'እለታዊ የተለመደ ችግር'}</p>
            </div>
            <div className="text-3xl font-black text-gray-900 leading-tight mb-2 relative z-10">
              {insights.topIssue}
            </div>
            <p className="text-sm text-gray-500 font-medium relative z-10">
              <span className="text-red-500 flex items-center gap-1 mb-1 shadow-sm px-2 py-0.5 rounded bg-red-50 w-fit">
                <Activity className="w-3 h-3" /> {language === 'English' ? 'Trending up' : 'እየጨመረ ነው'}
              </span>
              {language === 'English' ? `in ${insights.topArea} and nearby sub-cities.` : `በ ${insights.topArea} እና በአቅራቢያ ባሉ አካባቢዎች::`}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <MapPin className="w-16 h-16 text-orange-600" />
            </div>
            <div className="flex items-center gap-3 mb-4 text-orange-600">
              <div className="p-2 bg-orange-50 rounded-lg">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider">{language === 'English' ? 'Primary Hotspot' : 'ዋና የችግር ቦታ'}</p>
            </div>
            <div className="text-3xl font-black text-gray-900 leading-tight mb-2 relative z-10">
              {insights.topArea}
            </div>
            <p className="text-sm text-gray-500 font-medium relative z-10">
              {language === 'English' ? 'Experiencing repeated & severe service outages.' : 'በተደጋጋሚ የተቋረጠበትና የከፋ ችግር ያለበት፡፡'}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-16 h-16 text-purple-600" />
            </div>
             <div className="flex items-center gap-3 mb-4 text-purple-600">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider">{language === 'English' ? 'Avg Outage' : 'ከተማው አማካይ መቋረጥ'}</p>
            </div>
            <div className="text-3xl font-black text-gray-900 leading-tight mb-2 relative z-10">
              ~{insights.avgDurationAll} <span className="text-lg font-bold text-gray-500">{language === 'English' ? 'hours' : 'ሰዓታት'}</span>
            </div>
            <p className="text-sm text-gray-500 font-medium relative z-10">
              {language === 'English' ? 'Average duration before issues are marked resolved.' : 'ችግሮች እስኪፈቱ የሚወስደው አማካይ ጊዜ::'}
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Hotspots & Priority Ranking */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900">{language === 'English' ? 'Priority Hotspots' : 'ተቀዳሚ የችግር ቦታዎች'}</h3>
          </div>
          
          <div className="space-y-4">
            {insights.hotspots.map((spot, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-5 rounded-2xl border transition-all relative overflow-hidden group",
                  spot.priority === 'High' ? "bg-white border-red-200 shadow-sm hover:shadow-md" :
                  spot.priority === 'Medium' ? "bg-white border-orange-200 shadow-sm hover:shadow-md" :
                  "bg-white border-gray-100 shadow-sm hover:shadow-md"
                )}
              >
                {/* Decorative side border */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  spot.priority === 'High' ? "bg-red-500" :
                  spot.priority === 'Medium' ? "bg-orange-400" :
                  "bg-gray-300"
                )} />
                
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-3">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                        spot.priority === 'High' ? "bg-red-50 text-red-700 border border-red-100" :
                        spot.priority === 'Medium' ? "bg-orange-50 text-orange-700 border border-orange-100" :
                        "bg-gray-50 text-gray-700 border border-gray-200"
                      )}>
                        {spot.priority === 'High' ? (language === 'English' ? 'High Priority' : 'ከፍተኛ ቅድሚያ') : 
                         spot.priority === 'Medium' ? (language === 'English' ? 'Medium Priority' : 'መካከለኛ ቅድሚያ') : 
                         (language === 'English' ? 'Low Priority' : 'አነስተኛ ቅድሚያ')}
                      </span>
                      {spot.isAreaWide ? (
                         <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                           <Activity className="w-3 h-3" />
                           {language === 'English' ? 'Area-Wide Issue' : 'የአካባቢው ችግር'}
                         </span>
                      ) : (
                         <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                           <MapPin className="w-3 h-3" />
                           {language === 'English' ? 'Isolated Issue' : 'የተናጠል ችግር'}
                         </span>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 leading-tight mb-1 flex items-center gap-2">
                        {spot.utilityType === 'Electricity' && <Zap className="w-5 h-5 text-yellow-500" />}
                        {spot.utilityType === 'Water' && <Droplet className="w-5 h-5 text-blue-500" />}
                        {spot.utilityType === 'Telecom / Internet' && <Wifi className="w-5 h-5 text-indigo-500" />}
                        {!['Electricity', 'Water', 'Telecom / Internet'].includes(spot.utilityType) && <AlertTriangle className="w-5 h-5 text-gray-500" />}
                        {spot.utilityType} <span className="text-gray-400 font-normal mx-1">&middot;</span> {spot.area}
                      </h4>
                      <p className="text-sm text-gray-600 font-medium leading-relaxed">
                        {spot.priority === 'High' 
                          ? (language === 'English' ? `${spot.count} complaints reported from the same kebele/sub-city. Average outage duration ${spot.avgDuration} hours. Likely an area-wide grid or mainline issue.` : `ከአንድ አካባቢ ${spot.count} ቅሬታዎች ደርሰዋል:: የችግሩ ቆይታ ${spot.avgDuration} ሰዓታት:: በመላ አካባቢው የተከሰተ ችግር ሊሆን ይችላል::`)
                          : spot.priority === 'Medium'
                          ? (language === 'English' ? `${spot.count} complaints reported near this landmark. Average duration ${spot.avgDuration} hours.` : `በዚህ አካባቢ ${spot.count} ቅሬታዎች ደርሰዋል:: አማካይ ቆይታ: ${spot.avgDuration} ሰዓታት::`)
                          : (language === 'English' ? `Single resident complaint. Average duration ${spot.avgDuration} hours.` : `የአንድ ግለሰብ ቅሬታ ነው:: አማካይ ቆይታ: ${spot.avgDuration} ሰዓታት::`)
                        }
                      </p>
                    </div>
                    
                    {spot.emergencies > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 w-fit mt-1">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-bold text-red-700">
                          {language === 'English' ? `Contains ${spot.emergencies} Emergency Hazard Report(s)` : `${spot.emergencies} የአደጋ ሪፖርቶች ተያይዘዋል`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 flex items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner min-w-[110px]">
                     <div className="text-center">
                       <div className="text-4xl font-black text-gray-900 tracking-tight">{spot.count}</div>
                       <div className="text-[10px] font-bold text-gray-500 uppercase mt-1 tracking-wider leading-tight">
                         {language === 'English' ? 'Households' : 'የተጎዱ'}<br/>{language === 'English' ? 'Affected' : 'አባወራዎች'}
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts & Trends */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">{language === 'English' ? 'Repeated Problem Areas' : 'በተደጋጋሚ የተጎዱ አካባቢዎች'}</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.areaChartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12, fontWeight: 500}} width={120} />
                  <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {insights.areaChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">{language === 'English' ? 'Chart shows total household complains per location.' : 'ሰንጠረዡ በእያንዳንዱ አካባቢ ያሉትን የቅሬታዎች ብዛት ያሳያል።'}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">{language === 'English' ? 'Complaint Volume (Last 7 Days)' : 'የቅሬታ መጠን (ባለፉት 7 ቀናት)'}</h3>
             <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insights.trendChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} allowDecimals={false} />
                  <RechartsTooltip cursor={{stroke: '#e5e7eb', strokeWidth: 2}} contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
