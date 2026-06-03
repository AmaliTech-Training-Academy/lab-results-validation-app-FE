<script setup lang="ts">
import { ref } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import VButton from '@/components/base/VButton.vue'
import VPill from '@/components/base/VPill.vue'
import VStatCard from '@/components/base/VStatCard.vue'
import VIcon from '@/components/base/VIcon.vue'

type Role = 'admin' | 'instructor'

const role = ref<Role>('admin')
const activeId = ref('a-dashboard')

function handleNavigate(id: string) {
  activeId.value = id
}

function switchRole(r: Role) {
  role.value = r
  activeId.value = r === 'admin' ? 'a-dashboard' : 'i-dashboard'
}

const APP_ICONS = [
  'layout-dashboard', 'layers', 'folder-tree', 'graduation-cap',
  'users', 'bar-chart-2', 'plug-zap', 'settings', 'log-out',
  'microscope', 'upload-cloud', 'file-down', 'files', 'file-text',
  'check-circle', 'alert-triangle', 'info', 'chevron-right',
  'clock', 'download', 'search', 'plus', 'pencil', 'trash-2',
  'x', 'eye', 'eye-off', 'mail', 'lock', 'shield', 'copy',
  'lightbulb', 'user', 'chevron-down', 'more-vertical',
]

const COLORS = [
  { label: 'Orange',        token: '--orange',        hex: '#FF5A00' },
  { label: 'Orange deep',   token: '--orange-deep',   hex: '#A83900' },
  { label: 'Orange hover',  token: '--orange-hover',  hex: '#E85100' },
  { label: 'Navy',          token: '--navy',          hex: '#08283B', dark: true },
  { label: 'Navy 2',        token: '--navy-2',        hex: '#0F3349', dark: true },
  { label: 'Background',    token: '--bg',            hex: '#F7F6F2' },
  { label: 'Surface',       token: '--surface',       hex: '#FFFFFF' },
  { label: 'Surface alt',   token: '--surface-alt',   hex: '#FFF8F6' },
  { label: 'Border',        token: '--border',        hex: '#E2E0D8' },
  { label: 'Text',          token: '--text',          hex: '#0F1A20', dark: true },
  { label: 'Text secondary',token: '--text-secondary',hex: '#5A6870', dark: true },
  { label: 'Text muted',    token: '--text-muted',    hex: '#6B7280', dark: true },
  { label: 'Success',       token: '--success',       hex: '#1A6B3C', dark: true },
  { label: 'Success bg',    token: '--success-bg',    hex: '#EAF3DE' },
  { label: 'Danger',        token: '--danger',        hex: '#A32D2D', dark: true },
  { label: 'Danger bg',     token: '--danger-bg',     hex: '#FCEBEB' },
  { label: 'Warning',       token: '--warning',       hex: '#7A4A00', dark: true },
  { label: 'Warning bg',    token: '--warning-bg',    hex: '#FDF0D5' },
  { label: 'Info',          token: '--info',          hex: '#466177', dark: true },
  { label: 'Info bg',       token: '--info-bg',       hex: '#CAE6FF' },
]
</script>

<template>
  <AppShell
    :role="role"
    :active-id="activeId"
    crumb="Design system preview"
    :user-name="role === 'admin' ? 'David Kim' : 'Sarah Jenkins'"
    :user-role="role === 'admin' ? 'Admin' : 'Instructor'"
    :user-initials="role === 'admin' ? 'DK' : 'SJ'"
    @navigate="handleNavigate"
    @logout="() => {}"
  >
    <!-- ── Page header ─────────────────────────────────── -->
    <div class="page-head">
      <div>
        <h1 class="page-title">Design system preview</h1>
        <p class="page-sub">Visual review of all tokens and base components.</p>
      </div>
      <!-- Role switcher -->
      <div class="seg" style="width: 240px">
        <button
          :class="['seg-btn', { on: role === 'admin' }]"
          type="button"
          @click="switchRole('admin')"
        >
          <VIcon name="shield" :size="15" />
          Admin
        </button>
        <button
          :class="['seg-btn', { on: role === 'instructor' }]"
          type="button"
          @click="switchRole('instructor')"
        >
          <VIcon name="user" :size="15" />
          Instructor
        </button>
      </div>
    </div>

    <!-- ── 1. Color tokens ──────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Color tokens</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px">
        <div
          v-for="c in COLORS"
          :key="c.token"
          class="card"
          style="overflow: hidden"
        >
          <div :style="{ background: `var(${c.token})`, height: '52px' }" />
          <div style="padding: 8px 10px">
            <div :style="{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }">{{ c.label }}</div>
            <div class="t-mono" style="font-size: 11px; color: var(--text-secondary); margin-top: 2px">{{ c.hex }}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px">{{ c.token }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 2. Typography ────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Typography</h2>
      <div class="card card-pad" style="display: flex; flex-direction: column; gap: 20px">
        <div>
          <div class="t-label" style="margin-bottom: 6px">Display LG — Poppins 32 Bold</div>
          <div class="t-display-lg">Lab results validation</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Display MD — Poppins 24 Bold</div>
          <div class="t-display-md">Upload results</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Headline — Poppins 18 SemiBold</div>
          <div class="t-headline">Recent uploads</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Stat — Poppins 32 Bold</div>
          <div class="t-stat">1,248</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Body LG — Inter 16</div>
          <div class="t-body-lg">Drop your CSV here, or click to browse · .csv only · max 5 MB or 10,000 rows</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Body — Inter 14</div>
          <div class="t-body">The 43 valid rows have been successfully committed to the database.</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Label (eyebrow caps) — Inter 12 Medium</div>
          <div class="t-label">Total rows evaluated</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Caption — Inter 12</div>
          <div class="t-caption">Uploaded 2026-05-14 at 09:32 · lab_results_batch_Q3.csv</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Mono — JetBrains Mono 13</div>
          <div class="t-mono">VAL-DATE-01 · row 14 · lab_results_batch_Q3_final.csv</div>
        </div>
        <div>
          <div class="t-label" style="margin-bottom: 6px">Eyebrow — Inter 11 Medium wide-tracked</div>
          <div class="t-eyebrow">Secure 256-bit encrypted session</div>
        </div>
      </div>
    </section>

    <!-- ── 3. Buttons ───────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Buttons</h2>
      <div class="card card-pad" style="display: flex; flex-direction: column; gap: 20px">
        <!-- Primary -->
        <div>
          <div class="t-label" style="margin-bottom: 10px">Primary</div>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
            <VButton variant="primary">Upload results</VButton>
            <VButton variant="primary" icon="upload-cloud">Upload results</VButton>
            <VButton variant="primary" icon-right="arrow-right">Continue</VButton>
            <VButton variant="primary" size="sm">Save changes</VButton>
            <VButton variant="primary" size="sm" icon="plus">Add cohort</VButton>
            <VButton variant="primary" disabled>Disabled</VButton>
          </div>
        </div>
        <!-- Ghost -->
        <div>
          <div class="t-label" style="margin-bottom: 10px">Ghost</div>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
            <VButton variant="ghost">Cancel</VButton>
            <VButton variant="ghost" icon="download">Download CSV</VButton>
            <VButton variant="ghost" size="sm">Edit</VButton>
            <VButton variant="ghost" size="sm" icon="pencil">Edit</VButton>
          </div>
        </div>
        <!-- Danger -->
        <div>
          <div class="t-label" style="margin-bottom: 10px">Danger</div>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
            <VButton variant="danger">Delete cohort</VButton>
            <VButton variant="danger" icon="trash-2">Delete</VButton>
            <VButton variant="danger" size="sm">Remove</VButton>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 4. Pills ─────────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Pills / status badges</h2>
      <div class="card card-pad">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <VPill tone="success">Completed</VPill>
          <VPill tone="warning">Partial</VPill>
          <VPill tone="danger">Rejected</VPill>
          <VPill tone="info">Processing</VPill>
          <!-- With leading icon -->
          <VPill tone="success"><VIcon name="check-circle" :size="13" />43 accepted</VPill>
          <VPill tone="danger"><VIcon name="alert-triangle" :size="13" />5 rejected</VPill>
        </div>
      </div>
    </section>

    <!-- ── 5. Stat cards ────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Stat cards</h2>
      <div class="stats">
        <VStatCard
          label="Total rows evaluated"
          value="1,248"
          chip-icon="layers"
          chip-bg="var(--chip-orange-bg)"
          chip-fg="var(--chip-orange-fg)"
          foot-dot="var(--success)"
          foot-text="Last upload 2 hours ago"
        />
        <VStatCard
          label="Accepted rows"
          value="1,189"
          chip-icon="check-circle"
          chip-bg="var(--success-bg)"
          chip-fg="var(--success)"
          foot-dot="var(--success)"
          foot-text="95.3% acceptance rate"
        />
        <VStatCard
          label="Rejected rows"
          value="59"
          chip-icon="alert-triangle"
          chip-bg="var(--danger-bg)"
          chip-fg="var(--danger)"
          foot-dot="var(--danger)"
          foot-text="4.7% rejection rate"
        />
      </div>
    </section>

    <!-- ── 6. Icons ─────────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Icon set</h2>
      <div class="card card-pad">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px">
          <div
            v-for="name in APP_ICONS"
            :key="name"
            style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px; border-radius: var(--r-sm); border: 1px solid var(--border)"
          >
            <VIcon :name="name" :size="20" />
            <span style="font-size: 10px; color: var(--text-secondary); text-align: center; line-height: 1.3; font-family: var(--font-mono)">{{ name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 7. Table sample ──────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Table</h2>
      <div class="tbl-wrap">
        <div class="toolbar">
          <div class="search" style="flex: 1; max-width: 280px">
            <VIcon name="search" :size="15" color="var(--text-muted)" />
            <input placeholder="Search uploads…" />
          </div>
          <VButton variant="ghost" size="sm">
            <VIcon name="download" :size="15" />
            Export
          </VButton>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>File</th>
              <th>Uploaded by</th>
              <th>Date</th>
              <th>Rows</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="mono">lab_results_Q3_final.csv</span></td>
              <td>Sarah Jenkins</td>
              <td>2026-05-14</td>
              <td>48</td>
              <td><VPill tone="success">Completed</VPill></td>
              <td><button class="kebab" type="button"><VIcon name="more-vertical" :size="16" /></button></td>
            </tr>
            <tr>
              <td><span class="mono">lab_results_Q3_v2.csv</span></td>
              <td>James Osei</td>
              <td>2026-05-13</td>
              <td>52</td>
              <td><VPill tone="warning">Partial</VPill></td>
              <td><button class="kebab" type="button"><VIcon name="more-vertical" :size="16" /></button></td>
            </tr>
            <tr>
              <td><span class="mono">lab_results_cohort7.csv</span></td>
              <td>Ama Darko</td>
              <td>2026-05-12</td>
              <td>31</td>
              <td><VPill tone="danger">Rejected</VPill></td>
              <td><button class="kebab" type="button"><VIcon name="more-vertical" :size="16" /></button></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <span class="pager-count">Showing 3 of 24 uploads</span>
          <div class="pager-ctrls">
            <button class="pg-arrow" type="button"><VIcon name="chevron-left" :size="15" /></button>
            <button class="pg-num on" type="button">1</button>
            <button class="pg-num" type="button">2</button>
            <button class="pg-num" type="button">3</button>
            <span class="pg-ellipsis">…</span>
            <button class="pg-num" type="button">8</button>
            <button class="pg-arrow" type="button"><VIcon name="chevron-right" :size="15" /></button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 8. Callout ───────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Callout</h2>
      <div class="callout">
        <VIcon name="info" :size="20" color="var(--orange)" style="flex-shrink: 0; margin-top: 2px" />
        <div>
          <p class="callout-title">Attention required</p>
          <p class="callout-body">
            You may correct these specific errors and re-upload a corrections-only CSV. Previously
            accepted rows will not be re-processed. The uniqueness constraint prevents accidental
            duplication.
          </p>
        </div>
      </div>
    </section>

    <!-- ── 9. Form inputs ───────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Form inputs</h2>
      <div class="card card-pad" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px">
        <div class="ff">
          <label class="ff-label">Email address</label>
          <div class="input">
            <VIcon class="lead" name="mail" :size="16" />
            <input type="email" placeholder="name@organization.com" />
          </div>
        </div>
        <div class="ff">
          <label class="ff-label">Password</label>
          <div class="input">
            <VIcon class="lead" name="lock" :size="16" />
            <input type="password" placeholder="••••••••" />
          </div>
        </div>
        <div class="ff">
          <label class="ff-label">Cohort name</label>
          <div class="ff-input">
            <input type="text" placeholder="e.g. Cohort 7 — Spring 2026" />
          </div>
        </div>
        <div class="ff">
          <label class="ff-label">Max score</label>
          <div class="ff-input">
            <input type="number" placeholder="100" class="mono" />
          </div>
          <span class="ff-hint">Must match the configured max_score for this lab.</span>
        </div>
      </div>
    </section>

    <!-- ── 10. Dropzone ─────────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Dropzone</h2>
      <div class="dropzone">
        <div class="dz-icon">
          <VIcon name="upload-cloud" :size="28" />
        </div>
        <p class="dz-title">Drop your CSV here</p>
        <p class="dz-sub">or click to browse · .csv only · max 5 MB or 10,000 rows</p>
      </div>
    </section>

    <!-- ── 11. Empty state ──────────────────────────────── -->
    <section style="margin-bottom: 40px">
      <h2 class="t-headline" style="margin: 0 0 16px">Empty state</h2>
      <div class="card">
        <div class="empty">
          <div class="empty-ic"><VIcon name="file-text" :size="36" /></div>
          <p class="empty-title">No uploads yet</p>
          <p class="empty-body">Upload a CSV to see your validation results here.</p>
        </div>
      </div>
    </section>
  </AppShell>
</template>
