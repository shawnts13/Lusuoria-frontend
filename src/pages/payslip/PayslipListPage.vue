<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">工资单</span>
      <a-space :size="16">
        <a-date-picker v-model:value="selectedMonth" picker="month" format="YYYYMM" value-format="YYYYMM"
          placeholder="选择月份" @change="loadAll" />
        <a-radio-group v-model:value="currency" button-style="solid" @change="loadAll">
          <a-radio-button value="USD">USD</a-radio-button>
          <a-radio-button value="RMB">RMB</a-radio-button>
        </a-radio-group>
        <span v-if="exchangeRateInfo?.isMissing" class="exchange-rate-error">
          该月份汇率未维护，金额暂按 USD 展示
          <router-link v-if="authStore.isAdmin" to="/exchange-rates">去维护 ›</router-link>
        </span>
        <span v-else-if="exchangeRateInfo?.usdToCny" class="exchange-rate-display">
          汇率：1 USD = {{ exchangeRateInfo.usdToCny }} CNY
          <span class="rate-updated-by" v-if="exchangeRateInfo.updatedBy">
            （{{ exchangeRateInfo.updatedBy }} 维护）
          </span>
        </span>
      </a-space>
    </div>

    <template v-if="authStore.canManagePayslips">
      <!-- 管理层自己 -->
      <div class="management-card">
        <a-spin :spinning="loadingManagement">
          <template v-if="managementRow">
            <div class="mgmt-top">
              <span class="mgmt-title">管理层（{{ managementRow.employeeName }}）</span>
              <a-tag :color="managementRow.confirmed ? 'green' : 'orange'">
                {{ managementRow.confirmed ? '已确认' : '预计（实时更新）' }}
              </a-tag>
            </div>
            <div class="mgmt-body">
              <span class="mgmt-label">公司利润</span>
              <a class="mgmt-amount" @click="openDetail(managementRow)">{{ fmt(managementRow.totalAmount) }}</a>
              <a-space style="margin-left:24px">
                <a-button size="small" @click="openDetail(managementRow)">查看明细</a-button>
                <a-tooltip :title="managementRow.blockedReason">
                  <span>
                    <a-button v-if="!managementRow.ownActionConfirmed" type="primary" size="small"
                      :disabled="!!managementRow.blockedReason" @click="confirmRow(managementRow)">确认</a-button>
                    <a-popconfirm v-else title="确认取消这份工资单的确认？" @confirm="unconfirmRow(managementRow)">
                      <a-button size="small">取消确认</a-button>
                    </a-popconfirm>
                  </span>
                </a-tooltip>
              </a-space>
            </div>
            <div v-if="managementRow.blockedReason && !managementRow.ownActionConfirmed" class="mgmt-hint">
              {{ managementRow.blockedReason }}
            </div>
            <div class="formula-box">
              <div class="formula-title">
                公司利润 = 项目毛利 − 内部执行人力成本 − 负责人提成合计（含Bonus） − 内部其他员工成本 − 奖金合计
              </div>
              <div class="formula-row">
                <div class="formula-term">
                  <div class="formula-label">项目毛利</div>
                  <div class="formula-value">{{ fmt(managementRow.grossProfit) }}</div>
                </div>
                <div class="formula-op">−</div>
                <div class="formula-term">
                  <div class="formula-label">内部执行人力成本</div>
                  <div class="formula-value">{{ fmt(managementRow.executorPayTotal) }}</div>
                </div>
                <div class="formula-op">−</div>
                <div class="formula-term">
                  <div class="formula-label">负责人提成合计（含Bonus）</div>
                  <div class="formula-value">{{ fmt(managementRow.managerCommissionTotal) }}</div>
                </div>
                <div class="formula-op">−</div>
                <div class="formula-term">
                  <div class="formula-label">内部其他员工成本</div>
                  <div class="formula-value">{{ fmt(managementRow.otherStaffCost) }}</div>
                </div>
                <div class="formula-op">−</div>
                <div class="formula-term">
                  <div class="formula-label">奖金合计</div>
                  <div class="formula-value">{{ fmt(managementRow.extraBonusPayoutTotal) }}</div>
                </div>
                <div class="formula-op">=</div>
                <div class="formula-term formula-total">
                  <div class="formula-label">公司利润</div>
                  <div class="formula-value">{{ fmt(managementRow.totalAmount) }}</div>
                </div>
              </div>
            </div>
          </template>
        </a-spin>
      </div>

      <!-- 管理层作为"特殊的项目负责人"，名下（projectManagerId=管理层本人）如果确实有执行人员
           工作，也要能单独确认，入口独立于上面"确认公司利润"这个动作，跟项目负责人自己的
           那块"手下执行人员工资"卡片是同一套机制、同一套样式 -->
      <div v-if="managementExecutorDetail && managementExecutorDetail.executorWageRows && managementExecutorDetail.executorWageRows.length"
        class="management-card">
        <div class="mgmt-top">
          <span class="mgmt-title">管理层手下执行人员工资</span>
          <span class="confirm-hint">（当所有项目负责人都确认后，执行人员的工资单才会是最终版）</span>
        </div>
        <a-table :columns="executorWageColumns" :data-source="managementExecutorDetail.executorWageRows"
          :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'executorName'">
              <a-tag v-if="record.executorName && !record.isSummaryRow && !record.isTierSummaryRow" :color="colorForValue(record.executorName)">
                {{ record.executorName }}
              </a-tag>
            </template>
            <template v-if="column.key === 'brandTeam'">
              <span v-if="record.isTierSummaryRow" class="tier-summary-text">{{ record.brandName }}</span>
              <template v-else-if="record.isSummaryRow">汇总</template>
              <template v-else-if="record.isGroupSubtotal"><b>{{ record.brandName }}</b></template>
              <template v-else>
                <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
                <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
              </template>
            </template>
            <template v-if="column.key === 'videoTypeLabel'">{{ record.isTierSummaryRow ? '' : (record.videoTypeLabel || '—') }}</template>
            <template v-if="column.key === 'videoCount'">{{ record.isTierSummaryRow ? '' : (record.videoCount ?? 0) }}</template>
            <template v-if="column.key === 'unitPrice'">
              {{ (record.isTierSummaryRow || record.isSummaryRow || record.isGroupSubtotal) ? '' : fmt(record.unitPrice) }}
            </template>
            <template v-if="column.key === 'amount'">{{ record.isTierSummaryRow ? '' : fmt(record.amount) }}</template>
            <template v-if="column.key === 'confirmAction' && record.isGroupSubtotal">
              <a-space>
                <a-tag :color="record.groupConfirmed ? 'green' : 'orange'">
                  {{ record.groupConfirmed ? '已确认' : '预计' }}
                </a-tag>
                <a v-if="!record.groupConfirmed" @click="doConfirmManagementExecutorWage(record.executorId)">
                  请确认执行人员薪酬（涉及管理层部分）
                </a>
                <a-popconfirm v-else title="确认取消这个执行人员工资的确认？"
                  @confirm="doUnconfirmManagementExecutorWage(record.executorId)">
                  <a>取消确认</a>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>

      <div class="filter-bar">
        <a-select v-model:value="roleFilter" placeholder="角色（默认全部）" style="width:180px" allow-clear @change="loadList">
          <a-select-option value="项目负责人">项目负责人</a-select-option>
          <a-select-option value="执行人员">执行人员</a-select-option>
          <a-select-option value="财务和IT后勤">财务和IT后勤</a-select-option>
          <a-select-option value="法务">法务</a-select-option>
        </a-select>
      </div>

      <a-table :columns="columns" :data-source="rows" :loading="loadingList" :pagination="false" row-key="employeeId">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="colorForValue(record.employeeRole)">{{ record.employeeRole }}</a-tag>
          </template>

          <template v-if="column.key === 'pay'">
            <template v-if="record.employeeRole === '项目负责人' || record.employeeRole === '执行人员'">
              <span class="amount-cell">
                <a @click="openDetail(record)">{{ record.videoCount ?? 0 }} 条</a>
                <span style="margin:0 4px">/</span>
                <a @click="openDetail(record)">{{ fmt(record.baseAmount) }}</a>
              </span>
            </template>
            <template v-else-if="record.employeeRole === '财务' || record.employeeRole === 'IT后勤'">
              <span class="amount-cell">{{ fmt(record.baseAmount) }}</span>
            </template>
            <template v-else-if="record.employeeRole === '法务'">
              <template v-if="record.legalSalarySet">
                <span class="amount-cell">{{ fmt(record.baseAmount) }}</span>
                <a style="margin-left:8px" @click="openLegalSalaryModal(record)">编辑工资</a>
              </template>
              <a-button v-else size="small" @click="openLegalSalaryModal(record)">输入法务本月工资</a-button>
            </template>
          </template>

          <template v-if="column.key === 'tierBonus'">
            <span class="amount-cell" :style="record.tierBonusAmount != null ? '' : 'color:#bbb'">
              {{ record.tierBonusAmount != null ? fmt(record.tierBonusAmount) : '—' }}
            </span>
          </template>

          <template v-if="column.key === 'extraBonus'">
            <span class="amount-cell">{{ record.extraBonusAmount != null ? fmt(record.extraBonusAmount) : '未设置' }}</span>
            <a-tooltip v-if="record.ownActionConfirmed" title="请先取消确认，再设置奖金">
              <span style="margin-left:8px;color:#bbb;cursor:not-allowed">设置奖金</span>
            </a-tooltip>
            <a v-else style="margin-left:8px" @click="openExtraBonusModal(record)">设置奖金</a>
          </template>

          <template v-if="column.key === 'total'"><span class="amount-cell">{{ fmt(record.totalAmount) }}</span></template>

          <template v-if="column.key === 'status'">
            <a-tag :color="confirmTagColor(record)">{{ confirmTagLabel(record) }}</a-tag>
          </template>

          <template v-if="column.key === 'action'">
            <a-tooltip v-if="!record.ownActionConfirmed && record.blockedReason" :title="confirmTooltip(record)">
              <span>
                <a-button type="primary" size="small"
                  :disabled="!!record.blockedReason" @click="confirmRow(record)">确认</a-button>
              </span>
            </a-tooltip>
            <a-button v-else-if="!record.ownActionConfirmed" type="primary" size="small"
              @click="confirmRow(record)">确认</a-button>
            <a-popconfirm v-else title="确认取消这份工资单的确认？" @confirm="unconfirmRow(record)">
              <a-button size="small">取消确认</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </template>

    <template v-else-if="authStore.employeeRole === '项目负责人'">
      <!-- 项目负责人自己：跟管理层同一套"卡片 + 公式拆解"样式，不再是普通员工那种简单小卡片 -->
      <a-spin :spinning="loadingSelf">
        <template v-if="selfDetail">
          <div class="management-card">
            <div class="mgmt-top">
              <span class="mgmt-title">{{ authStore.displayName }}（项目负责人）</span>
              <a-tag :color="pmSelfTagColor(selfDetail)">{{ pmSelfTagLabel(selfDetail) }}</a-tag>
            </div>
            <!-- 项目负责人自己的提成工资单是否确认，是管理层的动作（在管理层的工资单列表页
                 逐行确认），不是项目负责人自己能操作的——这里只做只读展示 -->
            <div class="mgmt-body">
              <span class="mgmt-label">提成金额</span>
              <a class="mgmt-amount" @click="openSelfDetail">{{ fmt(selfDetail.baseAmount) }}</a>
              <a-space style="margin-left:24px">
                <a-button size="small" @click="openSelfDetail">查看明细</a-button>
              </a-space>
            </div>
            <div class="self-line">
              <span>提成金额</span><span>{{ fmt(selfDetail.baseAmount) }}</span>
            </div>
            <div v-if="selfDetail.tierBonusAmount != null" class="self-line">
              <span>阶梯Bonus</span><span>{{ fmt(selfDetail.tierBonusAmount) }}</span>
            </div>
            <div v-if="selfDetail.extraBonusAmount != null" class="self-line">
              <span>奖金</span><span>{{ fmt(selfDetail.extraBonusAmount) }}</span>
            </div>
            <div class="self-line" :class="{ total: !(selfDetail.executorWageRows && selfDetail.executorWageRows.length) }">
              <span>总工资</span><span>{{ fmt(selfDetail.totalAmount) }}</span>
            </div>
            <template v-if="selfDetail.executorWageRows && selfDetail.executorWageRows.length">
              <div class="self-line">
                <span>应发给执行人员的工资</span><span>{{ fmt(selfDetail.executorWageTotal) }}</span>
              </div>
              <div class="self-line total">
                <span>最终净得工资</span><span>{{ fmt(selfDetail.finalNetWage) }}</span>
              </div>
            </template>
          </div>

          <!-- 手下执行人员工资（未确认版）：只有当月确实涉及给执行人员发薪酬时才显示。
               2026-07 起改成按执行人员单独确认——每一行执行人员小计各自独立"确认"，
               不再是整个项目负责人一键打包确认 -->
          <div v-if="selfDetail.executorWageRows && selfDetail.executorWageRows.length" class="management-card">
            <div class="mgmt-top">
              <span class="mgmt-title">手下执行人员工资</span>
              <span class="confirm-hint">（当所有项目负责人都确认后，执行人员的工资单才会是最终版）</span>
            </div>
            <a-table :columns="executorWageColumns" :data-source="selfDetail.executorWageRows"
              :pagination="false" size="small" :row-key="(r, i) => i" :row-class-name="rowClassName">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'executorName'">
                  <a-tag v-if="record.executorName && !record.isSummaryRow && !record.isTierSummaryRow" :color="colorForValue(record.executorName)">
                    {{ record.executorName }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'brandTeam'">
                  <span v-if="record.isTierSummaryRow" class="tier-summary-text">{{ record.brandName }}</span>
                  <template v-else-if="record.isSummaryRow">汇总</template>
                  <template v-else-if="record.isGroupSubtotal"><b>{{ record.brandName }}</b></template>
                  <template v-else>
                    <a-tag v-if="record.brandName" :color="colorForValue(record.brandName)">{{ record.brandName }}</a-tag>
                    <a-tag v-if="record.teamName" :color="colorForValue(record.teamName)">{{ record.teamName }}</a-tag>
                  </template>
                </template>
                <template v-if="column.key === 'videoTypeLabel'">{{ record.isTierSummaryRow ? '' : (record.videoTypeLabel || '—') }}</template>
                <template v-if="column.key === 'videoCount'">{{ record.isTierSummaryRow ? '' : (record.videoCount ?? 0) }}</template>
                <template v-if="column.key === 'unitPrice'">
                  {{ (record.isTierSummaryRow || record.isSummaryRow || record.isGroupSubtotal) ? '' : fmt(record.unitPrice) }}
                </template>
                <template v-if="column.key === 'amount'">{{ record.isTierSummaryRow ? '' : fmt(record.amount) }}</template>
                <template v-if="column.key === 'confirmAction' && record.isGroupSubtotal">
                  <a-space>
                    <a-tag :color="record.groupConfirmed ? 'green' : 'orange'">
                      {{ record.groupConfirmed ? '已确认' : '预计' }}
                    </a-tag>
                    <a v-if="!record.groupConfirmed" @click="doConfirmExecutorWage(record.executorId)">请确认</a>
                    <a-popconfirm v-else title="确认取消这个执行人员工资的确认？"
                      @confirm="doUnconfirmExecutorWage(record.executorId)">
                      <a>取消确认</a>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </template>
      </a-spin>
    </template>

    <template v-else>
      <!-- 执行人员/财务/法务等角色自己的工资单：跟管理层/项目负责人一样用卡片样式，
           不再是没有版式的简单小卡片 -->
      <a-spin :spinning="loadingSelf">
        <div v-if="!authStore.employeeId" class="empty-hint">当前账号未关联员工记录，没有个人工资单。</div>
        <div v-else-if="selfDetail" class="management-card">
          <div class="mgmt-top">
            <span class="mgmt-title">{{ authStore.displayName }}</span>
            <a-tag v-if="selfDetail.confirmed" color="green">已确认</a-tag>
            <span v-else-if="selfDetail.type === 'EXECUTOR'" class="mixed-state-hint">
              工资按每个项目负责人分别确认，详见明细（非最终版，需管理层和相关的项目负责人都确认后才是最终版）
            </span>
            <a-tag v-else color="orange">工资单预计（等待管理层确认）</a-tag>
          </div>

          <div class="mgmt-body">
            <span class="mgmt-label">{{ selfDetail.type === 'EXECUTOR' ? '薪酬合计' : '工资' }}</span>
            <a v-if="selfDetail.type === 'EXECUTOR'" class="mgmt-amount" @click="openSelfDetail">{{ fmt(selfDetail.baseAmount) }}</a>
            <span v-else class="mgmt-amount">{{ fmt(selfDetail.baseAmount) }}</span>
            <a-button v-if="selfDetail.type === 'EXECUTOR'" size="small" style="margin-left:24px" @click="openSelfDetail">查看明细</a-button>
          </div>

          <div v-if="selfDetail.tierBonusAmount != null" class="self-line" style="margin-top:12px">
            <span>Bonus</span><span>{{ fmt(selfDetail.tierBonusAmount) }}</span>
          </div>
          <div v-if="selfDetail.extraBonusAmount != null" class="self-line">
            <span>奖金</span><span>{{ fmt(selfDetail.extraBonusAmount) }}</span>
          </div>

          <div class="self-line total">
            <span>总工资</span><span>{{ fmt(selfDetail.totalAmount) }}</span>
          </div>

          <div v-if="selfDetail.confirmed" class="footer-hint">
            若有疑问，请向管理层联系。
          </div>
        </div>
      </a-spin>
    </template>

    <PayslipDetailModal v-model:visible="detailModalVisible" :employee-id="detailEmployeeId"
      :employee-name="detailEmployeeName" :year-month="selectedMonth" :currency="currency" />

    <a-modal v-model:open="extraBonusModalVisible" title="设置奖金" width="420px" @ok="submitExtraBonus"
      :confirm-loading="savingExtraBonus">
      <a-form layout="vertical">
        <a-form-item label="奖金金额（留空表示不发放/清除已设置的奖金）">
          <a-input-number v-model:value="extraBonusForm.amount" style="width:100%" :precision="2" placeholder="金额" />
        </a-form-item>
        <a-form-item label="币种">
          <a-radio-group v-model:value="extraBonusForm.currency">
            <a-radio-button value="USD">USD</a-radio-button>
            <a-radio-button value="RMB"><b style="color:#ff4d4f">RMB</b></a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="legalSalaryModalVisible" title="法务本月工资" width="360px" @ok="submitLegalSalary"
      :confirm-loading="savingLegalSalary">
      <a-form layout="vertical">
        <a-form-item label="本月工资（人民币）">
          <a-input-number v-model:value="legalSalaryForm.amountRmb" style="width:100%" :precision="2" placeholder="金额" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { payslipApi, exchangeRateApi } from '../../api/index'
import { useAuthStore } from '../../store/auth'
import { colorForValue } from '../../utils/tagColor'
import PayslipDetailModal from './PayslipDetailModal.vue'

const authStore = useAuthStore()

const selectedMonth = ref(dayjs().format('YYYYMM'))
const currency = ref('RMB')
const roleFilter = ref(undefined)
const exchangeRateInfo = ref(null)

const loadingManagement = ref(false)
const loadingList = ref(false)
const loadingSelf = ref(false)

const managementRow = ref(null)
const managementExecutorDetail = ref(null)
const rows = ref([])
const selfDetail = ref(null)

const detailModalVisible = ref(false)
const detailEmployeeId = ref(null)
const detailEmployeeName = ref('')

// 薪酬/阶梯Bonus/奖金/总工资这几个金额列统一右对齐+等宽数字（2026-07-28 Shawn 反馈：
// IT后勤/财务/执行人员这几行的金额看着没对齐，不好比对——之前没有设置对齐方式，默认左对齐，
// 不同行金额位数不一样长短就会参差不齐；项目负责人凑巧看起来还行，其实也一样没对齐，
// 一起改掉，不单独只改这几个角色）
const columns = [
  { title: '姓名', dataIndex: 'employeeName', key: 'employeeName', width: 110 },
  { title: '角色', key: 'role', width: 110 },
  { title: '薪酬', key: 'pay', width: 220, align: 'right' },
  { title: '阶梯Bonus', key: 'tierBonus', width: 120, align: 'right' },
  { title: '奖金', key: 'extraBonus', width: 200, align: 'right' },
  { title: '总工资', key: 'total', width: 130, align: 'right' },
  { title: '状态', key: 'status', width: 240 },
  { title: '操作', key: 'action', width: 140 }
]

// "手下执行人员工资"表格用（项目负责人自己页面 + 管理层页面共用同一套列定义）。
// "确认状态"这一列只在每个执行人员的小计行（isGroupSubtotal）上有内容，其余明细行/汇总行留空；
// "梯度小结"行（isTierSummaryRow）只在"品牌方/红人团队"这一列展示一整句说明文字，其余列留空
// "品牌方/红人团队"/"项目视频类型"这两列之前没设置固定宽度，会被其它固定宽度列挤占空间，
// 窄的时候"项目视频类型"这种短文本会一个字一行、表格暴涨（2026-07-29 Shawn 反馈修复）
const executorWageColumns = [
  { title: '执行人员', key: 'executorName', width: 130 },
  { title: '品牌方/红人团队', key: 'brandTeam', width: 180 },
  { title: '项目视频类型', key: 'videoTypeLabel', width: 110 },
  { title: '视频数', key: 'videoCount', width: 80 },
  { title: '单价', key: 'unitPrice', width: 100 },
  { title: '薪酬金额', key: 'amount', width: 140 },
  { title: '确认状态', key: 'confirmAction', width: 260 }
]
function rowClassName(record) {
  if (record.isSummaryRow) return 'summary-row'
  if (record.isTierSummaryRow) return 'tier-summary-row'
  if (record.isGroupSubtotal) return 'subtotal-row'
  return ''
}

function fmt(val) {
  if (val == null) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  const prefix = currency.value === 'RMB' ? '¥' : '$'
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openDetail(record) {
  detailEmployeeId.value = record.employeeId
  detailEmployeeName.value = record.employeeName
  detailModalVisible.value = true
}
function openSelfDetail() {
  detailEmployeeId.value = authStore.employeeId
  detailEmployeeName.value = authStore.displayName
  detailModalVisible.value = true
}

async function loadManagement() {
  if (!selectedMonth.value) return
  loadingManagement.value = true
  try {
    const res = await payslipApi.management(selectedMonth.value, currency.value)
    managementRow.value = res.data || null
    // 管理层作为"特殊的项目负责人"，名下如果有执行人员工作，需要单独一块确认入口；
    // /management 只返回汇总行，这里额外拉一次明细才能拿到 executorWageRows 这批数据
    if (managementRow.value?.employeeId) {
      const detailRes = await payslipApi.detail(managementRow.value.employeeId, selectedMonth.value, currency.value)
      managementExecutorDetail.value = detailRes.data || null
    } else {
      managementExecutorDetail.value = null
    }
  } finally {
    loadingManagement.value = false
  }
}

async function loadList() {
  if (!selectedMonth.value) return
  loadingList.value = true
  try {
    const res = await payslipApi.list(selectedMonth.value, roleFilter.value, currency.value)
    rows.value = res.data || []
  } finally {
    loadingList.value = false
  }
}

async function loadSelf() {
  if (!selectedMonth.value || !authStore.employeeId) return
  loadingSelf.value = true
  try {
    const res = await payslipApi.me(selectedMonth.value, currency.value)
    selfDetail.value = res.data || null
  } finally {
    loadingSelf.value = false
  }
}

async function loadExchangeRateInfo() {
  if (!selectedMonth.value) return
  try {
    const res = await exchangeRateApi.getOne(selectedMonth.value)
    exchangeRateInfo.value = res.data || null
  } catch {
    exchangeRateInfo.value = null
  }
}

function loadAll() {
  loadExchangeRateInfo()
  if (authStore.canManagePayslips) {
    loadManagement()
    loadList()
  } else {
    loadSelf()
  }
}

// 执行人员的"确认"按钮不可点击时，提示具体去哪里操作，比后端那句列了一串项目负责人姓名的
// 通用文案更直接可操作；其余角色（管理层自己）的拦截提示保持原样，那边场景不一样
function confirmTooltip(record) {
  if (record.employeeRole === '执行人员') return '请先在"管理层手下执行人员工资"确认执行人员薪酬'
  return record.blockedReason
}

// 执行人员/项目负责人这两行的状态标签，统一用 confirmed（是否最终版）+ ownActionConfirmed
// （管理层自己那部分点没点）两个字段推，2026-07-28 定稿（第二次修正——之前"预计"阶段会
// 提前去看执行人员工资/项目负责人自己的执行人员工资确认到哪了，Shawn 明确要求改成不看，
// 统一先看管理层自己确认没确认，管理层没确认之前，不管别的当事人进度如何，一律"预计
// （等待管理层确认）"；只有管理层自己点了确认之后，才轮到看还差谁）：
// - !ownActionConfirmed → 预计（等待管理层确认），不看其他当事人进度
// - ownActionConfirmed && !confirmed → 中间态（执行人员："待其他项目负责人确认"；
//   项目负责人："等待项目负责人确认其执行人员工资"）
// - confirmed（=ownActionConfirmed 且相关的执行人员工资确认全部到位）→ 已确认
function confirmTagLabel(record) {
  if (record.employeeRole === '执行人员') {
    if (record.confirmed) return '已确认'
    if (record.ownActionConfirmed) return '待其他项目负责人确认'
    return '预计（等待管理层确认）'
  }
  if (record.employeeRole === '项目负责人') {
    if (record.confirmed) return '已确认'
    if (record.ownActionConfirmed) return '等待项目负责人确认其执行人员工资'
    return '预计（等待管理层确认）'
  }
  return record.confirmed ? '已确认' : '预计（等待管理层确认）'
}
function confirmTagColor(record) {
  if (record.employeeRole === '执行人员' || record.employeeRole === '项目负责人') {
    if (record.confirmed) return 'green'
    if (record.ownActionConfirmed) return 'yellow'
    return 'orange'
  }
  return record.confirmed ? 'green' : 'orange'
}

// 项目负责人自己页面那张只读卡片，跟管理层列表页里项目负责人那一行用同一套口径（见
// confirmTagLabel/confirmTagColor），只是这里没有按钮、纯展示
function pmSelfTagLabel(detail) {
  if (detail.confirmed) return '已确认'
  if (detail.ownActionConfirmed) return '等待项目负责人确认其执行人员工资'
  return '预计（等待管理层确认）'
}
function pmSelfTagColor(detail) {
  if (detail.confirmed) return 'green'
  if (detail.ownActionConfirmed) return 'yellow'
  return 'orange'
}

async function confirmRow(record) {
  try {
    await payslipApi.confirm(record.employeeId, selectedMonth.value)
    message.success('已确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}
async function unconfirmRow(record) {
  try {
    await payslipApi.unconfirm(record.employeeId, selectedMonth.value)
    message.success('已取消确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '取消确认失败')
  }
}

// ===== 项目负责人自己确认/取消确认名下某一个执行人员的工资（跟管理层对自己工资单的确认
// 完全独立，2026-07 起按执行人员单独确认，不再是一键确认所有执行人员） =====
async function doConfirmExecutorWage(executorId) {
  try {
    await payslipApi.confirmExecutorWages(selectedMonth.value, executorId)
    message.success('已确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}
async function doUnconfirmExecutorWage(executorId) {
  try {
    await payslipApi.unconfirmExecutorWages(selectedMonth.value, executorId)
    message.success('已取消确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '取消确认失败')
  }
}

// ===== 管理层作为"特殊的项目负责人"，按执行人员单独确认/取消确认自己名下执行人员的工资 =====
async function doConfirmManagementExecutorWage(executorId) {
  try {
    await payslipApi.confirmExecutorWages(selectedMonth.value, executorId, managementRow.value?.employeeId)
    message.success('已确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}
async function doUnconfirmManagementExecutorWage(executorId) {
  try {
    await payslipApi.unconfirmExecutorWages(selectedMonth.value, executorId, managementRow.value?.employeeId)
    message.success('已取消确认')
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '取消确认失败')
  }
}

// ===== 设置奖金 =====
const extraBonusModalVisible = ref(false)
const savingExtraBonus = ref(false)
const extraBonusForm = reactive({ employeeId: null, amount: null, currency: 'RMB' })

function openExtraBonusModal(record) {
  extraBonusForm.employeeId = record.employeeId
  extraBonusForm.amount = record.extraBonusAmountNative ?? null
  // 默认币种统一是RMB，不分角色；只有这条记录之前已经手动设置过奖金原始币种时才沿用那个值
  extraBonusForm.currency = record.extraBonusCurrencyNative || 'RMB'
  extraBonusModalVisible.value = true
}
async function submitExtraBonus() {
  savingExtraBonus.value = true
  try {
    await payslipApi.setExtraBonus(extraBonusForm.employeeId, selectedMonth.value,
      extraBonusForm.amount, extraBonusForm.currency)
    message.success('已保存')
    extraBonusModalVisible.value = false
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingExtraBonus.value = false
  }
}

// ===== 法务本月工资 =====
const legalSalaryModalVisible = ref(false)
const savingLegalSalary = ref(false)
const legalSalaryForm = reactive({ employeeId: null, amountRmb: null })

function openLegalSalaryModal(record) {
  legalSalaryForm.employeeId = record.employeeId
  legalSalaryForm.amountRmb = record.legalSalarySet ? record.baseAmount : null
  legalSalaryModalVisible.value = true
}
async function submitLegalSalary() {
  if (legalSalaryForm.amountRmb == null) {
    message.error('请填写本月工资')
    return
  }
  savingLegalSalary.value = true
  try {
    await payslipApi.setLegalSalary(legalSalaryForm.employeeId, selectedMonth.value, legalSalaryForm.amountRmb)
    message.success('已保存')
    legalSalaryModalVisible.value = false
    loadAll()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingLegalSalary.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
/* 薪酬/阶梯Bonus/奖金/总工资几列的金额数字用等宽数字，避免不同行金额位数不一样时
   看起来参差不齐（配合 columns 里的 align:'right' 一起用） */
.amount-cell {
  font-variant-numeric: tabular-nums;
}
.management-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: #fafafa;
}
.mgmt-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.mgmt-title {
  font-size: 15px;
  font-weight: 600;
}
.confirm-hint {
  font-size: 12px;
  color: #595959;
}
.tier-summary-text {
  color: #874d00;
  font-weight: 600;
  white-space: normal;
}
.mgmt-body {
  display: flex;
  align-items: center;
}
.mgmt-label {
  color: #595959;
  margin-right: 12px;
}
.mgmt-amount {
  font-size: 20px;
  font-weight: 700;
}
.mgmt-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #fa8c16;
}
.filter-bar {
  margin-bottom: 12px;
}
.formula-box {
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
}
.formula-title {
  font-size: 12px;
  color: #595959;
  margin-bottom: 10px;
}
.formula-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 4px;
}
.formula-term {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
  max-width: 160px;
  padding: 2px 6px;
  text-align: center;
}
.formula-label {
  font-size: 12px;
  color: #595959;
  margin-bottom: 4px;
}
.formula-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  font-family: 'Consolas', monospace;
}
.formula-op {
  font-size: 16px;
  color: #999;
  padding: 0 2px;
}
.formula-term.formula-total .formula-label {
  color: #333;
  font-weight: 600;
}
.formula-term.formula-total .formula-value {
  font-size: 17px;
  font-weight: 700;
  color: #000;
}
.exchange-rate-display {
  font-size: 13px;
  color: #595959;
}
.exchange-rate-display a, .rate-updated-by {
  color: #595959;
  margin-left: 4px;
}
.exchange-rate-error {
  font-size: 13px;
  color: #ff4d4f;
}
.exchange-rate-error a {
  color: #1677ff;
  margin-left: 4px;
}
.empty-hint {
  color: #595959;
  padding: 40px 0;
  text-align: center;
}
.mixed-state-hint {
  font-size: 13px;
  color: #262626;
}
.self-line {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}
.self-line.total {
  font-weight: 700;
  font-size: 18px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
  padding-top: 12px;
}
.footer-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #595959;
  text-align: right;
}
:deep(.summary-row) {
  font-weight: 600;
  background: #fafafa;
}
:deep(.tier-summary-row) {
  background: #fffbe6;
}
:deep(.subtotal-row) {
  font-weight: 600;
  background: #f7f7f7;
}
/* 每个执行人员小计行下面加一条更明显的分隔线，跟下一个执行人员的明细行区分开——
   表格行本身没有"外边距"这个概念，用加粗的单元格底边框模拟视觉上的间隔 */
:deep(.subtotal-row td) {
  border-bottom: 2px solid #bfbfbf !important;
}
</style>
