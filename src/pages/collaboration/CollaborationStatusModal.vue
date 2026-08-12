<template>
  <a-modal :open="visible" title="状态流转" width="460px"
    :confirm-loading="saving" @ok="handleSave" @cancel="close">
    <div style="margin-bottom:16px; color:#262626; font-size:13px">
      {{ record?.accountName }}
      <span v-if="record?.internalProjectNo">（{{ record.internalProjectNo }}）</span>
    </div>
    <div v-if="record?.hasPendingRollbackRequest"
      style="margin-bottom:12px;color:#faad14;font-size:13px">
      该记录当前已有一条待审核的"视频项目进度倒退"申请，等待管理员处理中。
    </div>
    <a-form layout="vertical">
      <a-form-item label="视频项目进度">
        <a-select v-model:value="progress" placeholder="选择视频项目进度">
          <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value"
            :disabled="(FINANCE_ONLY_PROGRESS.includes(o.value) && !authStore.canSetFinanceSettlementProgress)
              || (!authStore.canWrite && !QUALIFYING_PROGRESS.includes(o.value))">
            {{ o.label }}
          </a-select-option>
        </a-select>
        <div v-if="!authStore.canSetFinanceSettlementProgress" style="font-size:12px;color:#595959;margin-top:2px">
          "已加入客户未结算列表"/"客户已结算"仅能由财务/管理层设置
        </div>
        <div v-else-if="!authStore.canWrite" style="font-size:12px;color:#595959;margin-top:2px">
          财务账号只能在"已发布（未结算）"、"已加入客户未结算列表"、"客户已结算"之间流转
        </div>
      </a-form-item>
      <!-- 2026-08 新增：流转到"已发布（未结算）"等三个阶段时，视频发布链接/发布时间直接在这里填，
           不用再跳去"编辑"表单——所有能操作到这一步的角色（财务除外）都可以自己填，不受编辑表单
           那边"仅 ADMIN 能改视频发布时间"的限制 -->
      <template v-if="needsPublishInfo">
        <a-form-item label="视频发布链接" required>
          <div v-for="(link, idx) in publishLinks" :key="'sl-' + idx"
            style="display:flex;gap:8px;margin-bottom:6px">
            <a-input v-model:value="publishLinks[idx]" placeholder="粘贴视频发布链接" style="flex:1" />
            <a-button danger size="small" @click="removePublishLink(idx)">删除</a-button>
          </div>
          <a-button type="dashed" size="small" block :disabled="!canAddMoreLinks" @click="addPublishLink">+ 添加新链接</a-button>
          <div style="font-size:12px;color:#595959;margin-top:4px">
            <template v-if="canAddMoreLinks">该红人合作跟踪涉及多个平台，可以按平台数量添加多条发布链接</template>
            <template v-else>该红人合作跟踪只涉及1个平台，只能填1条发布链接</template>
          </div>
        </a-form-item>
        <a-form-item label="视频发布时间" required>
          <a-date-picker v-model:value="publishDateLocal" style="width:100%" value-format="YYYY-MM-DD" />
          <div style="font-size:12px;color:#595959;margin-top:2px">
            填了视频发布链接后默认带成今天，可以改成实际发布日期
          </div>
        </a-form-item>
      </template>
      <!-- 2026-08 新增：视频项目进度已经是"已发布（未结算）"、这次流转又原样选回"已发布
           （未结算）"（进度没变），单纯回显已有的视频发布链接/发布时间供核对，不算需要重新
           填写——纯展示，不是输入框，也不参与保存校验（后端 progress 没变化时本来就不会
           重新写这两个字段，展示成可编辑的输入框反而容易让人误以为改了就能生效） -->
      <template v-if="viewingUnchangedPublishedUnsettled">
        <a-form-item label="视频发布链接">
          <div v-if="record?.publishLink">
            <div v-for="(link, idx) in splitLinks(record.publishLink)" :key="'vl-' + idx"
              style="margin-bottom:4px">
              <a :href="link" target="_blank" rel="noopener" style="word-break:break-all">{{ link }}</a>
            </div>
          </div>
          <span v-else style="color:#bbb">—</span>
        </a-form-item>
        <a-form-item label="视频发布时间">
          <span style="color:#262626">{{ record?.publishDate ? formatDate(record.publishDate) : '—' }}</span>
        </a-form-item>
      </template>
      <div v-if="willAutoSetPayment" style="margin-bottom:12px;color:#1677ff;font-size:12px">
        首次进入"已发布（未结算）"，系统会自动判定红人结款进度为「{{ autoPaymentLabel }}」，不需要在这里手动选
      </div>
      <a-form-item label="倒退原因" v-if="isRollback" required>
        <p style="color:#595959;font-size:13px;margin-bottom:8px">
          该记录"红人结款进度"已有值，视频项目进度要改回不满足前置条件的状态，不会立即生效，
          需要提交管理员审核，请说明原因。
        </p>
        <a-textarea v-model:value="reason" :rows="3" placeholder="请说明原因" />
      </a-form-item>
      <a-form-item label="备注" v-if="progress === 'DELAYED'" required>
        <p v-if="record?.notes" style="color:#595959;font-size:13px;margin-bottom:8px">
          当前已填备注：{{ record.notes }}
        </p>
        <a-textarea v-model:value="notes" :rows="3" placeholder="请填写备注" />
      </a-form-item>
      <!-- 2026-08 新增，同日改：流转到前期制作流程这8个状态时，客户方的项目订单可选填写
           （拿到后填写，不强制）——但只在这条记录本来就还没有这个字段时才展示这个输入框；
           记录已经有值的话不重复展示（不是"回显"，是"不显示"，避免这几个早期状态的流转弹窗
           总是多出一个已经填过的字段）。判断依据是 record 这个 prop 本身（弹窗打开期间稳定
           不变），不能用 clientOrderId 这个正在编辑的 ref——否则用户刚打字第一个字符，
           这个 ref 从空变成非空，输入框会跟着消失。跟下面"已加入客户未结算列表"/"客户已结算"
           那个必填的是同一个字段，两者按 progress 互斥展示，共用同一个 clientOrderId ref。
           2026-08 修复：漏了 requiresClientOrderId 判断，导致品牌方不涉及这个字段时这个
           可选输入框也照样弹出来，跟下面必填版本的判断条件不一致——这里补上，两处保持一致 -->
      <a-form-item label="客户方的项目订单"
        v-if="isEarlyStageClientOrderIdProgress(progress) && !record?.clientOrderId && requiresClientOrderId">
        <a-input v-model:value="clientOrderId" placeholder="拿到后填写" />
      </a-form-item>
      <a-form-item label="客户方的项目订单"
        v-if="(progress === 'JOINED_CLIENT_UNSETTLED_LIST' || progress === 'SETTLED') && requiresClientOrderId" required>
        <a-input v-model:value="clientOrderId" placeholder="请填写客户方的项目订单" />
      </a-form-item>
      <a-form-item label="客户方付款批次单号"
        v-if="progress === 'SETTLED' && authStore.canSetFinanceSettlementProgress && requiresClientPaymentBatch" required>
        <a-input v-model:value="clientPaymentBatch" placeholder="请填写客户方付款批次单号" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'
import { useAuthStore } from '../../store/auth'
import { formatDate } from '../../utils/dateFormat'

const { getOptions } = useOptions()
const authStore = useAuthStore()

// 跟后端 requireFinanceForSettlementProgress() 保持一致：这两个状态只能由财务/管理层/
// 项目负责人/执行人员/IT后勤设置
const FINANCE_ONLY_PROGRESS = ['JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']

// 跟后端 CollaborationTrackingService.EARLY_STAGE_CLIENT_ORDER_ID_PROGRESSES 保持一致：
// 前期制作流程这8个状态（待客户出brief~已发布未结算），流转时"客户方的项目订单"可选填写
// （2026-08 新增，Shawn 要求：拿到订单号就顺手登记，不用等到"已加入客户未结算列表"才能填）
const EARLY_STAGE_CLIENT_ORDER_ID_PROGRESS = [
  'PENDING_CLIENT_BRIEF', 'CONTRACT_SENT', 'INFLUENCER_ORDERED', 'SHOOTING_GUIDE_SENT',
  'PENDING_DRAFT', 'PENDING_REVISION', 'PENDING_PUBLISH', 'PUBLISHED_UNSETTLED'
]
function isEarlyStageClientOrderIdProgress(v) { return !!v && EARLY_STAGE_CLIENT_ORDER_ID_PROGRESS.includes(v) }

const props = defineProps({
  visible: Boolean,
  record: Object,
  brands: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved', 'need-executor-cost'])

// 跟后端 CollaborationProgress.allowsPaymentProgress() 保持一致
const QUALIFYING_PROGRESS = ['PUBLISHED_UNSETTLED', 'JOINED_CLIENT_UNSETTLED_LIST', 'SETTLED']
function qualifies(v) { return !!v && QUALIFYING_PROGRESS.includes(v) }

const progress = ref(null)
const reason = ref('')
const notes = ref('')
const clientPaymentBatch = ref('')
const clientOrderId = ref('')
const saving = ref(false)

// 视频发布链接/发布时间（2026-08 新增，见下面 needsPublishInfo）：链接支持多条，
// 用法跟"编辑"表单 CollaborationFormModal 的 publishLinks 数组一致
const publishLinks = ref([''])
const publishDateLocal = ref(null)

// 2026-08 修复：这条记录的"发布平台"有几个，"添加新链接"就最多能加到几条——只有1个平台的
// 记录（占绝大多数）直接禁用"添加"按钮，避免误填多条链接却只对应1个平台。平台数≥2的记录
// 才允许按平台数量逐条添加。record.platform 是换行拼接的多值字符串，跟 record.publishLink
// 是同一套拼接约定（参见 CollaborationListPage.vue 的 splitMulti）
const platformCount = computed(() => {
  const raw = props.record?.platform
  if (!raw) return 1
  return raw.split('\n').map(s => s.trim()).filter(Boolean).length || 1
})
const canAddMoreLinks = computed(() => publishLinks.value.length < platformCount.value)

function addPublishLink() { if (canAddMoreLinks.value) publishLinks.value.push('') }
function removePublishLink(idx) {
  publishLinks.value.splice(idx, 1)
  if (publishLinks.value.length === 0) publishLinks.value.push('')
}
function splitLinks(str) {
  if (!str) return []
  return str.split('\n').map(s => s.trim()).filter(Boolean)
}
// 填了视频发布链接后，视频发布时间还空着的话默认带成今天（北京时间），用户可以再改——
// 不覆盖用户已经手动选过的日期。
// 2026-08 修复：之前用 watch(publishLinks, (val, oldVal) => ...) 的 deep 监听去比较
// "从没内容变成有内容"这个瞬间，但 publishLinks[idx] 是原地修改数组元素（v-model 绑定到
// 数组下标），deep watcher 触发时 val 和 oldVal 其实是同一个数组引用（Vue 3 的既定行为：
// 深度监听不会在触发前克隆旧值），导致 hadContent 用 oldVal 算出来的结果跟 hasContent
// 完全一样，"由无到有"这个判断永远不成立，时间就再也不会被自动带入。改成只看"现在有没有
// 内容 + 时间是不是还空着"，不再依赖不可靠的新旧值比较，效果跟原意图一致
watch(publishLinks, () => {
  const hasContent = publishLinks.value.some(l => l && l.trim())
  if (hasContent && !publishDateLocal.value) {
    publishDateLocal.value = formatDate(new Date())
  }
}, { deep: true })

// 品牌方是否涉及这两个字段（2026-08 新增），跟后端 Brand.requiresClientOrderId()/
// requiresClientPaymentBatch() 保持一致：null/true 都按"涉及"处理，只有显式 false 才是"不涉及"
const currentBrand = computed(() => props.brands?.find(b => b.id === props.record?.brandId))
const requiresClientOrderId = computed(() => currentBrand.value?.involvesClientOrderId !== false)
const requiresClientPaymentBatch = computed(() => currentBrand.value?.involvesClientPaymentBatch !== false)

// 弹窗打开那一刻的原始值，用来判断这次改动算不算"倒退"（不随下面 progress 的实时编辑而变化，
// 保证即使中途改来改去，isRollback 判断的始终是"跟数据库原值相比"）。红人结款进度
// 2026-07 起不再通过这个弹窗手动设置，只读用来判断是不是"倒退"
const original = reactive({ progress: null, paymentProgress: null })

watch(() => props.visible, v => {
  if (v && props.record) {
    progress.value = props.record.progress || null
    reason.value = ''
    // 默认带入当前已有的值，用户可以直接沿用也可以改——不是每次都要求从空白重填
    notes.value = props.record.notes || ''
    clientPaymentBatch.value = props.record.clientPaymentBatch || ''
    clientOrderId.value = props.record.clientOrderId || ''
    publishLinks.value = props.record.publishLink ? splitLinks(props.record.publishLink) : ['']
    publishDateLocal.value = props.record.publishDate ? formatDate(props.record.publishDate) : null
    original.progress = props.record.progress || null
    original.paymentProgress = props.record.influencerPaymentProgress || null
  }
})

// 首次进入"已发布（未结算）"：后端会自动判定红人结款进度（按品牌方是否需要invoice），
// 跟后端 enteringPublishedUnsettled 的条件保持一致，纯展示提示用
const willAutoSetPayment = computed(() =>
  progress.value === 'PUBLISHED_UNSETTLED' && original.progress !== 'PUBLISHED_UNSETTLED'
)
const autoPaymentLabel = computed(() => {
  const brand = props.brands?.find(b => b.id === props.record?.brandId)
  return brand && brand.requiresInvoice === false ? '待结款（不涉及invoice）' : '待红人发送invoice'
})

// 该记录数据库里是否已经有发布链接+发布时间——已经有的话，流转到"已加入客户未结算列表"/
// "客户已结算"就不用在这里重新问一遍了
const recordHasPublishInfo = computed(() => !!props.record?.publishLink && !!props.record?.publishDate)

// 2026-08 改：三个阶段（已发布未结算/已加入客户未结算列表/客户已结算）各自只问各自新增的信息，
// 不再像以前那样每次流转都把前面阶段的字段重新问一遍（"需要填的信息一直在增加"的冗余问题）。
// 视频发布链接/发布时间只在流转到"已发布（未结算）"——三个阶段里第一个要求"视频已发布"的
// 节点——时在这里填，直接更新到这条记录上，不用再跳去"编辑"表单；后两个阶段不重复问。
// 唯一的兜底：理论上允许跳过"已发布（未结算）"直接流转到后两个阶段（不常见），这种情况下
// 记录确实还没有这两个字段，不补填的话会撞到后端"缺发布链接/时间"的校验却没地方填，
// 所以数据缺失时仍然在这里出现——不违反"减少冗余"的初衷，只在真的缺数据时才出现
const needsPublishInfo = computed(() =>
  qualifies(progress.value) && progress.value !== original.progress
  && (progress.value === 'PUBLISHED_UNSETTLED' || !recordHasPublishInfo.value)
)

// 2026-08 新增：进度已经是"已发布（未结算）"，这次流转又原样选回同一个状态（没有变化）——
// 单纯回显视频发布链接/发布时间供核对，见上面模板注释
const viewingUnchangedPublishedUnsettled = computed(() =>
  progress.value === 'PUBLISHED_UNSETTLED' && original.progress === 'PUBLISHED_UNSETTLED'
)

// 倒退判定：数据库原值里红人结款进度已有值 + 原视频项目进度符合条件 +
// 这次要改成不符合条件的另一个状态，就是"倒退"，需要走审核。
// "折损"永远不算倒退（2026-07 修复，跟后端 isRollback 的排除条件保持一致）——
// 折损代表记录彻底作废，走下面单独的"备注必填、直接生效"分支，不需要审核
const isRollback = computed(() =>
  progress.value !== 'DELAYED'
  && !!original.paymentProgress
  && qualifies(original.progress)
  && !!progress.value
  && !qualifies(progress.value)
  && progress.value !== original.progress
)

function close() { emit('update:visible', false) }

async function handleSave() {
  if (isRollback.value && !reason.value?.trim()) {
    message.warning('请填写倒退原因')
    return
  }
  if (progress.value === 'DELAYED' && !notes.value?.trim()) {
    message.warning('请填写备注')
    return
  }
  const joinedPublishLinks = publishLinks.value.map(l => l.trim()).filter(Boolean).join('\n')
  if (needsPublishInfo.value && (!joinedPublishLinks || !publishDateLocal.value)) {
    message.warning('请先填写视频发布链接和视频发布时间，才能流转到这个状态')
    return
  }
  const needsOrderId = (progress.value === 'JOINED_CLIENT_UNSETTLED_LIST' || progress.value === 'SETTLED')
    && requiresClientOrderId.value
  if (needsOrderId && !clientOrderId.value?.trim()) {
    message.warning('该品牌方涉及"客户方的项目订单"，请先填写')
    return
  }
  // 前期制作流程这8个状态：客户方的项目订单可选填写，不强制、有值才提交——跟上面 v-if 的
  // 展示条件保持一致，品牌方不涉及这个字段时不提交（字段也不会渲染，clientOrderId 恒为空，
  // 这里加上判断只是让代码意图跟展示条件对得上，不是修复实际问题）
  const submitsEarlyStageOrderId = isEarlyStageClientOrderIdProgress(progress.value) && requiresClientOrderId.value
  const needsPaymentBatch = progress.value === 'SETTLED' && authStore.canSetFinanceSettlementProgress
    && requiresClientPaymentBatch.value
  if (needsPaymentBatch && !clientPaymentBatch.value?.trim()) {
    message.warning('该品牌方涉及"客户方付款批次"，请先填写客户方付款批次单号')
    return
  }
  saving.value = true
  try {
    const res = await collaborationApi.updateStatus(props.record.id, {
      progress: progress.value,
      reason: isRollback.value ? reason.value.trim() : null,
      notes: progress.value === 'DELAYED' ? notes.value.trim() : null,
      clientOrderId: (needsOrderId || submitsEarlyStageOrderId) ? clientOrderId.value.trim() : null,
      clientPaymentBatch: needsPaymentBatch ? clientPaymentBatch.value.trim() : null,
      publishLink: needsPublishInfo.value ? joinedPublishLinks : null,
      publishDate: needsPublishInfo.value ? publishDateLocal.value : null
    })
    if (res.data?.pendingApproval) {
      message.success('已提交审核，待管理员同意后生效')
    } else {
      message.success('状态已更新')
    }
    emit('saved')
    close()

    // 内部执行成本设置流程触发：后端已经判断过条件（视频项目进度达到前置条件，或红人结款进度
    // 被设置了值，且这条记录有执行人员、还没设置过内部执行成本），这里直接按标记弹出即可
    if (res.data?.needExecutorCost) {
      emit('need-executor-cost', props.record)
    }
  } finally { saving.value = false }
}
</script>
