// Shared design tokens — import in every page
export const C = {
  g50:'#f0fdf4', g100:'#dcfce7', g200:'#bbf7d0', g300:'#86efac',
  g400:'#4ade80', g500:'#22c55e', g600:'#16a34a', g700:'#15803d',
  g800:'#166534', g900:'#14532d', g950:'#052e16',
  white:'#ffffff', amber:'#f59e0b', amberBg:'#fef3c7', amberText:'#92400e',
  blue:'#3b82f6', blueBg:'#dbeafe', blueText:'#1d4ed8',
  red:'#ef4444', redBg:'#fee2e2', redText:'#991b1b',
  serif:"'Fraunces',Georgia,serif",
  sans:"'DM Sans','Helvetica Neue',Arial,sans-serif",
}

export const badge = {
  green: {display:'inline-block',background:'#dcfce7',color:'#166534',fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20} as React.CSSProperties,
  amber: {display:'inline-block',background:'#fef3c7',color:'#92400e',fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20} as React.CSSProperties,
  blue:  {display:'inline-block',background:'#dbeafe',color:'#1d4ed8',fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20} as React.CSSProperties,
  red:   {display:'inline-block',background:'#fee2e2',color:'#991b1b',fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20} as React.CSSProperties,
}

export const FILE_STATUS: Record<string, {label:string; badge: React.CSSProperties}> = {
  draft:           {label:'Draft',           badge: badge.amber},
  payment_pending: {label:'Awaiting payment',badge: badge.amber},
  paid:            {label:'Queued',          badge: badge.blue},
  matched:         {label:'Matched',         badge: badge.blue},
  in_review:       {label:'In review',       badge: badge.blue},
  awaiting_sign:   {label:'Awaiting sign',   badge: badge.blue},
  signed:          {label:'Signed',          badge: badge.green},
  completed:       {label:'Completed ✓',     badge: badge.green},
  cancelled:       {label:'Cancelled',       badge: badge.red},
  overdue:         {label:'Overdue',         badge: badge.red},
}
