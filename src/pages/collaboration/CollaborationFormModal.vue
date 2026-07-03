<template>
  <a-modal :open="visible" :title="form.id ? '编辑合作跟踪' : '新建合作跟踪'"
    width="640px" :confirm-loading="saving"
    @ok="handleSave" @cancel="close" :destroy-on-close="false">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">

      <a-form-item v-if="form.internalProjectNo" label="内部项目编号">
        <a-input :value="form.internalProjectNo" disabled />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="红人社媒完整名字" name="accountName">
            <a-select v-model:value="form.accountName" allow-clear show-search
              :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())"
              placeholder="从红人库选择" @change="onInfluencerChange">
              <a-select-option v-for="inf in influencers" :key="inf.accountName" :value="inf.accountName">
                {{ inf.accountName }}
              </a-select-option>
            </a-select>
            <div v-if="snapshotInfo" style="font-size:12px;color:#888;margin-top:2px">
              团队：{{ snapshotInfo.teamName || '—' }}　国家/市场：{{ snapshotInfo.countryMarket || '—' }}
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="品牌方" name="brandId">
            <a-select v-model:value="form.brandId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              :placeholder="form.accountName ? '选择品牌方' : '请先选择红人'"
              :disabled="!form.accountName">
              <a-select-option v-for="b in availableBrands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
            </a-select>
            <div v-if="form.accountName && availableBrands.length === 0"
              style="font-size:12px;color:#c00000;margin-top:2px">
              该红人尚未在红人模块关联任何品牌方，请先去红人模块维护
            </div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="合作平台">
        <a-select v-model:value="form.platforms" mode="multiple" allow-clear placeholder="可多选">
          <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="需求内容">
        <a-textarea v-model:value="form.demandContent" :rows="2" placeholder="填写具体产品名，如 手持游戏机、Padfolio文件夹" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="16">
          <a-form-item label="视频发布链接">
            <a-input v-model:value="form.publishLink" placeholder="前期可留空" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="发布时间">
            <a-date-picker v-model:value="form.publishDate" style="width:100%" value-format="YYYY-MM-DD" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="6">
          <a-form-item label="进度">
            <a-select v-model:value="form.progress" :disabled="!!form.id" allow-clear placeholder="选择进度">
              <a-select-option v-for="o in getOptions('collab_progress')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
            <div v-if="form.id" style="font-size:12px;color:#ff4d4f;margin-top:2px">进度请使用"状态流转"功能修改</div>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="项目视频类型">
            <a-select v-model:value="form.videoType" allow-clear placeholder="选择视频类型">
              <a-select-option v-for="o in getOptions('video_type')" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="客户方的项目订单">
            <a-input v-model:value="form.clientOrderId" placeholder="拿到后填写" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="客户方付款批次">
            <a-input v-model:value="form.clientPaymentBatch" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item v-if="form.videoType === 'OLD_MATERIAL_REPOST'" label="采买旧视频的原链接">
        <a-input v-model:value="form.oldMaterialSourceLink" placeholder="填写被采买的那条旧视频的原始链接" />
        <div style="font-size:12px;color:#888;margin-top:2px">
          系统会自动查重（同一视频不同链接写法也能识别），重复采买会被拒绝保存
        </div>
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="项目负责人">
            <a-select v-model:value="form.projectManagerId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              placeholder="选择负责人">
              <a-select-option v-for="e in employees" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="内部执行人员">
            <a-select v-model:value="form.executorId" allow-clear show-search
              :filter-option="(input, opt) => opt.label.includes(input)"
              placeholder="选择执行人员">
              <a-select-option v-for="e in employees" :key="e.id" :value="e.id" :label="e.name">{{ e.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <template v-if="canViewFinancials">
        <a-divider orientation="left" style="font-size:13px">财务信息</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="红人视频制作与发布成本（美金）">
              <a-input v-model:value="form.influencerCost" placeholder="金额或备注" />
              <div v-if="isRemark(form.influencerCost)" style="font-size:12px;color:#c00000">备注，将以红色展示</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="客户合作价格（美金）">
              <a-input v-model:value="form.clientPrice" placeholder="金额或备注" />
              <div v-if="isRemark(form.clientPrice)" style="font-size:12px;color:#c00000">备注，将以红色展示</div>
            </a-form-item>
          </a-col>
        </a-row>
      </template>

    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { collaborationApi } from '../../api/index'
import { useOptions } from '../../composables/useOptions'

const props = defineProps({
  visible: { type: Boolean, default: false },
  record: { type: Object, default: null },
  canViewFinancials: { type: Boolean, default: false },
  brands: { type: Array, default: () => [] },
  influencers: { type: Array, default: () => [] },
  employees: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const { getOptions } = useOptions()
const formRef = ref()
const saving  = ref(false)

const form = reactive({
  id: null,
  internalProjectNo: null,
  brandId: null, accountName: null,
  platforms: [], demandContent: '',
  publishLink: '', publishDate: null,
  progress: null, videoType: null, oldMaterialSourceLink: null, clientOrderId: '', clientPaymentBatch: '',
  projectManagerId: null, executorId: null,
  influencerCost: '', clientPrice: ''
})

const rules = {
  accountName: [{ required: true, message: '请选择红人社媒完整名字', trigger: 'change' }]
}

const snapshotInfo = computed(() => {
  if (!form.accountName) return null
  const inf = props.influencers.find(i => i.accountName === form.accountName)
  return inf ? { teamName: inf.teamName, countryMarket: inf.countryMarket } : null
})

// 品牌方下拉只显示当前选中红人在红人模块里已关联的品牌方
const availableBrands = computed(() => {
  if (!form.accountName) return []
  const inf = props.influencers.find(i => i.accountName === form.accountName)
  if (!inf || !inf.brandIds || !inf.brandIds.length) return []
  return props.brands.filter(b => inf.brandIds.includes(b.id))
})

watch(() => props.visible, (v) => {
  if (v) {
    if (props.record) {
      const rec = props.record
      Object.assign(form, {
        id:            rec.id,
        internalProjectNo: rec.internalProjectNo || null,
        brandId:       rec.brandId      || null,
        accountName:   rec.accountName  || null,
        platforms:     splitMulti(rec.platform),
        demandContent: rec.demandContent || '',
        publishLink:   rec.publishLink   || '',
        publishDate:   rec.publishDate ? formatDate(rec.publishDate) : null,
        progress:      rec.progress      || null,
        videoType:     rec.videoType     || null,
        oldMaterialSourceLink: rec.oldMaterialSourceLink || null,
        clientOrderId: rec.clientOrderId || '',
        clientPaymentBatch: rec.clientPaymentBatch || '',
        projectManagerId: rec.projectManagerId || null,
        executorId: rec.executorId || null,
        influencerCost: rec.influencerCost || '',
        clientPrice:    rec.clientPrice    || ''
      })
    } else {
      Object.assign(form, {
        id:null, internalProjectNo:null, brandId:null, accountName:null, platforms:[], demandContent:'',
        publishLink:'', publishDate:null, progress:null, videoType:null, oldMaterialSourceLink:null, clientOrderId:'', clientPaymentBatch:'',
        projectManagerId:null, executorId:null,
        influencerCost:'', clientPrice:''
      })
    }
  }
})

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}
function formatDate(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}
function onInfluencerChange() {
  // 切换红人后，原选中的品牌方可能不再适用，清空让用户重新选
  form.brandId = null
}

function close() { emit('update:visible', false) }

async function doSave() {
  saving.value = true
  try {
    const payload = {
      id:            form.id,
      brandId:       form.brandId,
      accountName:   form.accountName,
      platform:      form.platforms.join('\n') || null,
      demandContent: form.demandContent || null,
      publishLink:   form.publishLink || null,
      publishDate:   form.publishDate || null,
      progress:      form.progress || null,
      videoType:     form.videoType || null,
      oldMaterialSourceLink: form.videoType === 'OLD_MATERIAL_REPOST' ? (form.oldMaterialSourceLink || null) : null,
      clientOrderId: form.clientOrderId || null,
      clientPaymentBatch: form.clientPaymentBatch || null,
      projectManagerId: form.projectManagerId || null,
      executorId: form.executorId || null,
      influencerCost: form.influencerCost,
      clientPrice:    form.clientPrice
    }
    const res = await collaborationApi.save(payload)

    // 后端用特殊 code 表示：已有关联项目订单不让改订单号 / 去重命中
    if (res.code === 4090 || res.code === 4091) {
      saving.value = false
      Modal.warning({ title: '无法保存', content: res.message })
      return
    }

    message.success('保存成功')
    emit('saved')
    close()
  } catch (e) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  doSave()
}
</script>
