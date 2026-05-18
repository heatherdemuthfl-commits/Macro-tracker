import { useState, useEffect, useRef } from "react";

const GOALS = { protein: 180, carbs: 188, fat: 60, currentWeight: 178, goalWeight: 165 };

const QUICK_ADDS = [
  { name: "2 Eggs", protein: 12, carbs: 1, fat: 10, calories: 140 },
  { name: "Siggi's Vanilla", protein: 16, carbs: 9, fat: 0, calories: 100 },
  { name: "Chomps Stick", protein: 9, carbs: 0, fat: 6, calories: 90 },
  { name: "RX Bar Choc Sea Salt", protein: 12, carbs: 23, fat: 8, calories: 210 },
  { name: "Cottage Cheese 1/2c", protein: 14, carbs: 4, fat: 2, calories: 90 },
  { name: "Chicken Sausage", protein: 14, carbs: 1, fat: 7, calories: 120 },
  { name: "Strawberries 1c", protein: 1, carbs: 11, fat: 0, calories: 45 },
  { name: "Protein Shake", protein: 25, carbs: 5, fat: 2, calories: 130 },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function Ring({ value, goal, label, color, unit = "g" }) {
  const pct = Math.min((value / goal) * 100, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width="88" height="88" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.6s ease" }} />
      </svg>
      <div style={{ marginTop:-66, marginBottom:18, textAlign:"center", zIndex:1 }}>
        <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", fontFamily:"monospace" }}>
          {value}<span style={{ fontSize:11, color:"#94a3b8" }}>{unit}</span>
        </div>
        <div style={{ fontSize:9, color:"#64748b", letterSpacing:1, textTransform:"uppercase" }}>
          of {goal}{unit}
        </div>
      </div>
      <div style={{ fontSize:11, fontWeight:600, color:"#94a3b8", letterSpacing:1, textTransform:"uppercase" }}>
        {label}
      </div>
    </div>
  );
}

export default function MacroTracker() {
  const [entries, setEntries] = useState([]);
  const [allDays, setAllDays] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [workoutDay, setWorkoutDay] = useState(true);
  const [viewDate, setViewDate] = useState(todayKey());
  const [showHistory, setShowHistory] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const inputRef = useRef();
  const calorieGoal = workoutDay ? 2050 : 1850;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("macrotracker-all-days");
      if (saved) {
        const data = JSON.parse(saved);
        setAllDays(data);
        setEntries(data[todayKey()] || []);
      }
    } catch(e) {}
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    try {
      const updated = { ...allDays, [viewDate]: entries };
      setAllDays(updated);
      localStorage.setItem("macrotracker-all-days", JSON.stringify(updated));
    } catch(e) {}
  }, [entries]);

  const totals = entries.reduce(
    (acc, e) => ({
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      calories: acc.calories + (e.calories || 0),
    }),
    { protein:0, carbs:0, fat:0, calories:0 }
  );

  async function lookupFood(foodText) {
    setLoading(true);
    setAiStatus("Looking up macros...");
    try {
      const res = await fetch("/api/lookup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ food: foodText })
});
const parsed = await res.json();

          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role:"user", content:`You are a nutrition database. Given this food entry: "${foodText}" return ONLY a raw JSON object with no markdown and no explanation with these fields: name (string), protein (number in grams), carbs (number in grams), fat (number in grams), calories (number). Use accurate nutrition data.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiStatus("");
      return parsed;
    } catch(e) {
      setAiStatus("Could not look up that food. Try again.");
      setTimeout(() => setAiStatus(""), 3000);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!input.trim()) return;
    const food = await lookupFood(input.trim());
    if (food) {
      setEntries(prev => [...prev, { ...food, id: Date.now() }]);
      setInput("");
      inputRef.current?.focus();
    }
  }

  function handleQuickAdd(item) {
    setEntries(prev => [...prev, { ...item, id: Date.now() }]);
  }

  function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function switchDay(date) {
    setViewDate(date);
    setEntries(allDays[date] || []);
    setShowHistory(false);
  }

  const calPct = Math.min((totals.calories / calorieGoal) * 100, 100);
  const remainingProtein = Math.max(GOALS.protein - totals.protein, 0);
  const remainingCal = Math.max(calorieGoal - totals.calories, 0);
  const historyDates = Object.keys(allDays).sort().reverse().filter(d => d !== todayKey());

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1a", color:"#f1f5f9", fontFamily:"sans-serif", paddingBottom:80 }}>
      <div style={{ background:"linear-gradient(135deg,#0f172a,#1e293b)", borderBottom:"1px solid #1e293b", padding:"20px 20px 16px", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:3, color:"#22d3ee", textTransform:"uppercase", fontWeight:700, marginBottom:2 }}>MACRO TRACKER</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#f1f5f9", fontFamily:"monospace" }}>{viewDate === todayKey() ? "Today" : viewDate}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setWorkoutDay(w => !w)} style={{ padding:"6px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:workoutDay?"#22d3ee22":"#1e293b", color:workoutDay?"#22d3ee":"#64748b" }}>
              {workoutDay ? "WORKOUT" : "REST DAY"}
            </button>
            <button onClick={() => setShowHistory(h => !h)} style={{ padding:"6px 12px", borderRadius:20, border:"1px solid #1e293b", cursor:"pointer", fontSize:11, background:"transparent", color:"#64748b" }}>
              {showHistory ? "CLOSE" : "HISTORY"}
            </button>
          </div>
        </div>
        <div style={{ marginTop:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>CALORIES</span>
            <span style={{ fontSize:11, fontFamily:"monospace", color:calPct>=100?"#ef4444":"#22d3ee" }}>{totals.calories} / {calorieGoal} kcal</span>
          </div>
          <div style={{ height:6, background:"#1e293b", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${calPct}%`, borderRadius:3, background:calPct>=100?"#ef4444":calPct>=75?"#22c55e":"#22d3ee", transition:"width 0.6s ease" }} />
          </div>
          <div style={{ fontSize:10, color:"#475569", marginTop:4, textAlign:"right" }}>{remainingCal > 0 ? `${remainingCal} kcal remaining` : "Goal reached!"}</div>
        </div>
      </div>

      {showHistory && (
        <div style={{ background:"#0f172a", borderBottom:"1px solid #1e293b", padding:"12px 20px" }}>
          <div style={{ fontSize:11, color:"#64748b", marginBottom:10, textTransform:"uppercase", letterSpacing:2 }}>Past Days</div>
          {historyDates.length === 0 && <div style={{ color:"#475569", fontSize:13 }}>No history yet</div>}
          {historyDates.map(d => {
            const dt = allDays[d] || [];
            const dtotals = dt.reduce((a,e) => ({ protein:a.protein+e.protein, calories:a.calories+e.calories }), { protein:0, calories:0 });
            return (
              <button key={d} onClick={() => switchDay(d)} style={{ display:"flex", justifyContent:"space-between", width:"100%", padding:"10px 0", background:"transparent", border:"none", borderBottom:"1px solid #1e293b", cursor:"pointer", color:"#f1f5f9" }}>
                <span style={{ fontSize:13, fontFamily:"monospace" }}>{d}</span>
                <span style={{ fontSize:11, color:"#64748b" }}>{dtotals.protein}g protein · {dtotals.calories} kcal</span>
              </button>
            );
          })}
          {viewDate !== todayKey() && (
            <button onClick={() => switchDay(todayKey())} style={{ marginTop:10, padding:"8px 16px", background:"#22d3ee22", color:"#22d3ee", border:"none", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:700 }}>Back to Today</button>
          )}
        </div>
      )}

      <div style={{ padding:"20px 20px 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", background:"#0f172a", borderRadius:16, padding:"20px 10px", border:"1px solid #1e293b", marginBottom:20 }}>
          <Ring value={Math.round(totals.protein)} goal={GOALS.protein} label="Protein" color="#22d3ee" />
          <Ring value={Math.round(totals.carbs)} goal={GOALS.carbs} label="Carbs" color="#f59e0b" />
          <Ring value={Math.round(totals.fat)} goal={GOALS.fat} label="Fat" color="#a78bfa" />
        </div>

        {remainingProtein > 0 ? (
          <div style={{ background:"#0f172a", border:"1px solid #22d3ee33", borderRadius:12, padding:"10px 14px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, color:"#94a3b8" }}>Protein remaining</span>
            <span style={{ fontSize:16, fontWeight:800, color:"#22d3ee", fontFamily:"monospace" }}>{remainingProtein}g</span>
          </div>
        ) : (
          <div style={{ background:"#052e16", border:"1px solid #22c55e44", borderRadius:12, padding:"10px 14px", marginBottom:16, textAlign:"center", fontSize:13, color:"#22c55e", fontWeight:700 }}>Protein goal crushed!</div>
        )}

        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:11, letterSpacing:2, color:"#64748b", marginBottom:10, textTransform:"uppercase" }}>Log Food</div>
          <div style={{ display:"flex", gap:8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && !loading && handleAdd()}
              placeholder="e.g. 6oz grilled chicken breast"
              style={{ flex:1, background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none" }} />
            <button onClick={handleAdd} disabled={loading || !input.trim()} style={{ padding:"10px 18px", background:loading?"#1e293b":"#22d3ee", color:loading?"#64748b":"#0a0f1a", border:"none", borderRadius:10, cursor:loading?"not-allowed":"pointer", fontSize:13, fontWeight:800 }}>
              {loading ? "..." : "ADD"}
            </button>
          </div>
          {aiStatus && <div style={{ fontSize:11, color:"#22d3ee", marginTop:8, fontStyle:"italic" }}>{aiStatus}</div>}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, letterSpacing:2, color:"#64748b", marginBottom:10, textTransform:"uppercase" }}>Quick Add Favorites</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {QUICK_ADDS.map(item => (
              <button key={item.name} onClick={() => handleQuickAdd(item)} style={{ padding:"7px 12px", background:"#0f172a", border:"1px solid #1e293b", borderRadius:20, color:"#94a3b8", fontSize:11, cursor:"pointer", fontWeight:600 }}>
                {item.name} <span style={{ color:"#475569" }}>{item.protein}g</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, letterSpacing:2, color:"#64748b", marginBottom:10, textTransform:"uppercase" }}>{viewDate === todayKey() ? "Today's Log" : `Log for ${viewDate}`}</div>
          {entries.length === 0 && (
            <div style={{ background:"#0f172a", border:"1px dashed #1e293b", borderRadius:12, padding:24, textAlign:"center", color:"#475569", fontSize:13 }}>No food logged yet. Type above or tap a quick add!</div>
          )}
          {entries.map((entry, i) => (
            <div key={entry.id || i} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#f1f5f9", marginBottom:4 }}>{entry.name}</div>
                <div style={{ display:"flex", gap:12 }}>
                  <span style={{ fontSize:11, color:"#22d3ee" }}>{entry.protein}g P</span>
                  <span style={{ fontSize:11, color:"#f59e0b" }}>{entry.carbs}g C</span>
                  <span style={{ fontSize:11, color:"#a78bfa" }}>{entry.fat}g F</span>
                  <span style={{ fontSize:11, color:"#64748b" }}>{entry.calories} kcal</span>
                </div>
              </div>
              {viewDate === todayKey() && (
                <button onClick={() => removeEntry(entry.id)} style={{ background:"transparent", border:"none", color:"#334155", cursor:"pointer", fontSize:18, padding:"0 4px" }}>x</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:16, marginTop:20 }}>
          <div style={{ fontSize:11, letterSpacing:2, color:"#64748b", marginBottom:12, textTransform:"uppercase" }}>Weight Goal</div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:"monospace", color:"#f1f5f9" }}>{GOALS.currentWeight} <span style={{ fontSize:13, color:"#64748b" }}>lbs</span></div>
              <div style={{ fontSize:11, color:"#64748b" }}>Current</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:"monospace", color:"#22c55e" }}>{GOALS.goalWeight} <span style={{ fontSize:13, color:"#64748b" }}>lbs</span></div>
              <div style={{ fontSize:11, color:"#64748b" }}>Goal</div>
            </div>
          </div>
          <div style={{ fontSize:11, color:"#475569", textAlign:"center", marginTop:8 }}>{GOALS.currentWeight - GOALS.goalWeight} lbs to go · ~8-12 weeks at your deficit</div>
        </div>
      </div>
    </div>
  );
}

