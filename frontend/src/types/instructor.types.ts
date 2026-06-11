export interface LegendRow {
  lab: string
  max: number
}

export interface ColumnRef {
  name: string
  desc: string
  req: boolean
}

export interface TemplateData {
  filename: string
  legend: LegendRow[]
  columns: ColumnRef[]
}
