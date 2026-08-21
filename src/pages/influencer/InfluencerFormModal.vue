<template>
  <a-modal :open="visible"
    :title="record ? '编辑红人' : '新建红人'"
    width="960px" :destroy-on-close="true" :confirm-loading="saving"
    @cancel="emit('update:visible', false)">
    <template #footer>
      <a-button @click="emit('update:visible', false)">取消</a-button>
      <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
    </template>
    <a-form ref="formRef" :model="form" :label-col="{ span: 8 }" :wrapper-col="{ span: 14 }" size="middle">
      <a-row :gutter="24">
        <!-- 左列 -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">基本信息</a-divider>

          <a-form-item label="红人类型" name="influencerType"
            :rules="[{ required: true, message: '请选择红人类型' }]">
            <a-select v-model:value="form.influencerType">
              <a-select-option v-for="o in getOptions('influencer_type')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="红人社媒完整名字" name="accountName"
            :rules="[{ required: true, message: '请填写红人社媒完整名字' }]">
            <a-input v-model:value="form.accountName" />
          </a-form-item>

          <a-form-item label="品牌方-团队" required :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
            <div v-for="(pair, idx) in form.brandTeamPairs" :key="idx"
              style="display:flex;gap:8px;margin-bottom:8px">
              <a-tooltip :title="brandNameById(pair.brandId)">
                <a-select v-model:value="pair.brandId" placeholder="品牌方" style="flex:1;min-width:0" allow-clear show-search
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())"
                  @change="onBrandChangeInPair(pair)">
                  <a-select-option v-for="b in brands" :key="b.id" :value="b.id" :label="b.name">{{ b.name }}</a-select-option>
                </a-select>
              </a-tooltip>
              <a-tooltip :title="teamNameById(pair.teamId)">
                <!-- 2026-08 修复：这里之前直接遍历全量 teams，没有按这一行选中的品牌方过滤，
                     导致比如选了"TEMU海外"（没配团队）还是能看到、选中"TEMU中国"的团队——
                     团队本来就归属唯一品牌方（InfluencerTeam.brandId），必须按 pair.brandId 过滤 -->
                <a-select v-model:value="pair.teamId" placeholder="团队（可不选）" style="flex:1;min-width:0" allow-clear show-search
                  :disabled="!pair.brandId"
                  :filter-option="(input, opt) => opt.label.toLowerCase().includes(input.trim().toLowerCase())">
                  <a-select-option v-for="t in teamsForBrand(pair.brandId)" :key="t.id" :value="t.id" :label="t.name">{{ t.name }}</a-select-option>
                </a-select>
              </a-tooltip>
              <a-button danger @click="form.brandTeamPairs.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="dashed" block @click="form.brandTeamPairs.push({ brandId: null, teamId: null })">
              + 添加品牌方-团队关联
            </a-button>
            <div style="font-size:12px;color:#595959;margin-top:4px">
              一个红人可以关联多个"品牌方-团队"对，同一品牌方下也可以配多个不同团队；团队可以不选（表示这个品牌方下暂时没配团队）
            </div>
            <div style="font-size:12px;color:#ff4d4f;margin-top:4px">
              未找到相应的红人团队？请联系管理层在"品牌方/红人团队管理"模块新建相应的团队。
            </div>
          </a-form-item>

          <a-form-item label="服务国家/市场">
            <a-select v-model:value="form.countryMarkets" mode="multiple" show-search allow-clear
              placeholder="可多选"
              :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())">
              <a-select-option v-for="o in getOptions('country')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="平台">
            <a-select v-model:value="form.platforms" mode="multiple" allow-clear
              placeholder="可多选，或填写主页链接后自动识别">
              <a-select-option v-for="o in getOptions('platform')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="所属领域">
            <a-select v-model:value="form.domains" mode="multiple" allow-clear>
              <a-select-option v-for="d in domains" :key="d.name" :value="d.name">
                {{ d.name }}
              </a-select-option>
            </a-select>
            <a-input-search v-if="authStore.canWrite" v-model:value="newDomainName"
              placeholder="输入新领域名称后回车添加"
              enter-button="添加领域" style="margin-top:6px"
              @search="handleAddDomain" />
          </a-form-item>

          <a-form-item label="粉丝量">
            <a-input-number v-model:value="form.followerCount" style="width:100%"
              :min="0" :formatter="v => v ? Number(v).toLocaleString() : ''"
              :parser="v => v.replace(/,/g, '')" />
          </a-form-item>

          <a-form-item label="建联情况">
            <a-select v-model:value="form.contactStatus" allow-clear>
              <a-select-option v-for="o in getOptions('contact_status')" :key="o.value" :value="o.value">
                {{ o.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="跟进人">
            <a-select v-model:value="form.followerPerson" allow-clear show-search
              :filter-option="(input, opt) => opt.value.toLowerCase().includes(input.trim().toLowerCase())">
              <a-select-option v-for="emp in followerCandidates" :key="emp.id" :value="emp.name">
                {{ emp.name }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <!-- 特殊回款周期（2026-08-21 新增）：Shawn 要求红色字体标记——这个字段优先级最高，
               会覆盖品牌方/团队级别配置的回款周期规则，用红色突出提醒操作人这是一个特殊配置 -->
          <a-form-item>
            <template #label><span style="color:#c00000">特殊回款周期</span></template>
            <a-input-number v-model:value="form.specialPaymentCycleDays" :min="1" :precision="0"
              style="width:100%" addon-after="天" placeholder="留空=没有特殊回款周期" />
            <div style="font-size:12px;color:#c00000;margin-top:2px">
              配置后优先级最高，覆盖品牌方/团队级别配置的回款周期规则——该红人关联的需求完成进度
              达到100%时开始计时，超过这个天数视为回款逾期
            </div>
          </a-form-item>
        </a-col>

        <!-- 右列 -->
        <a-col :span="12">
          <a-divider orientation="left" style="font-size:13px">联系方式</a-divider>

          <a-form-item label="红人邮箱">
            <a-input v-model:value="form.email" />
          </a-form-item>
          <a-form-item label="红人电话">
            <a-input v-model:value="form.contacts.phone" placeholder="+1 234 567 8900" />
          </a-form-item>
          <a-form-item label="红人WhatsApp">
            <a-input v-model:value="form.contacts.whatsapp" placeholder="+1 234 567 8900" />
          </a-form-item>
          <a-form-item label="红人Line">
            <a-input v-model:value="form.contacts.line" placeholder="Line ID" />
          </a-form-item>
          <a-form-item label="红人Telegram">
            <a-input v-model:value="form.contacts.telegram" placeholder="@telegram_xxx" />
          </a-form-item>

          <a-divider orientation="left" style="font-size:13px">链接</a-divider>

          <a-form-item label="主页链接">
            <div v-for="(link, idx) in form.links" :key="'link-' + idx"
              style="display:flex;gap:8px;margin-bottom:6px">
              <a-input v-model:value="form.links[idx]" placeholder="https://..." style="flex:1" />
              <a-button danger size="small" @click="form.links.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="dashed" size="small" @click="form.links.push('')">+ 添加链接</a-button>
          </a-form-item>

          <!-- 敏感字段 -->
          <template v-if="canViewFinancials">
            <a-divider orientation="left" style="font-size:13px">财务信息</a-divider>
            <a-form-item label="红人视频制作与发布成本（美金）" :label-col="{ span: 12 }">
              <a-input v-model:value="form.influencerCost" placeholder="金额或备注" />
              <div v-if="isRemark(form.influencerCost)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
            <a-form-item label="视频投流成本（美金）">
              <a-input v-model:value="form.adSpendCost" placeholder="金额或备注" />
              <div v-if="isRemark(form.adSpendCost)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
            <a-form-item label="视频版权成本（美金）">
              <a-input v-model:value="form.copyrightCost" placeholder="金额或备注" />
              <div v-if="isRemark(form.copyrightCost)"
                style="font-size:12px;color:#c00000;margin-top:2px">备注信息，将以红色展示</div>
            </a-form-item>
          </template>

          <a-divider orientation="left" style="font-size:13px">其他</a-divider>
          <a-form-item label="备注">
            <a-textarea v-model:value="form.notes" :rows="3" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { influencerApi, domainApi } from '../../api/index'
import { useReferenceData } from '../../composables/useReferenceData'
import { useAuthStore } from '../../store/auth'
import { useOptions } from '../../composables/useOptions'

const props = defineProps({
  visible:           Boolean,
  record:            Object,
  canViewFinancials: { type: Boolean, default: false },
  brands:            { type: Array, default: () => [] },
  domains:           { type: Array, default: () => [] },
  teams:             { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved', 'domain-added'])

const formRef          = ref()
const saving           = ref(false)
const employees        = ref([])
const newDomainName    = ref('')
const authStore        = useAuthStore()
const { getOptions }   = useOptions()
const { loadEmployees, invalidateInfluencers } = useReferenceData()

// 跟进人只能从"项目负责人"、"管理层"（管理层是特殊的项目负责人，跟红人合作跟踪里
// "项目负责人"字段的候选人范围口径一致，见 CollaborationTrackingExcelHandler/
// CollaborationFormModal 的 projectManagerCandidates）和"执行人员"这三个角色里选——
// 法务、IT后勤、财务不负责跟进红人，不应该出现在这个下拉框里（对应 Employee.role 的
// 取值，见后端 OptionConfigController 的 employee_role 选项配置）
const FOLLOWER_ROLES = ['项目负责人', '管理层', '执行人员']
const followerCandidates = computed(() => employees.value.filter(emp => FOLLOWER_ROLES.includes(emp.role)))

const EMPTY_CONTACTS = () => ({ phone: '', whatsapp: '', line: '', telegram: '' })

const form = reactive({
  id: null,
  influencerType: 'OVERSEAS_INFLUENCER',
  accountName: '',
  brandTeamPairs: [], countryMarkets: [], platforms: [],
  domains: [],
  followerCount: null, links: [],
  email: '',
  contacts: EMPTY_CONTACTS(),
  contactStatus: 'UNDEVELOPED',
  followerPerson: null,
  specialPaymentCycleDays: null,
  influencerCost: '', notes: '',
  adSpendCost: '', copyrightCost: ''
})

const CHINA_DEFAULT_DOMAINS = ['科技', '童装', '玩具', 'AI素材']

const PLATFORM_RULES = [
  { pattern: 'tiktok.com',    platform: 'TikTok' },
  { pattern: 'instagram.com', platform: 'Instagram' },
  { pattern: 'youtube.com',   platform: 'YouTube' },
  { pattern: 'youtu.be',      platform: 'YouTube' },
  { pattern: 'facebook.com',  platform: 'Facebook' },
  { pattern: 'weibo.com',     platform: '微博' },
  { pattern: 'xiaohongshu.com', platform: '小红书' },
  { pattern: 'xhslink.com',   platform: '小红书' },
  { pattern: 'douyin.com',    platform: '抖音' },
]

function detectPlatformsFromLinks(links) {
  const detected = new Set()
  links.filter(l => l.includes('http')).forEach(link => {
    const lower = link.toLowerCase()
    PLATFORM_RULES.forEach(rule => {
      if (lower.includes(rule.pattern)) detected.add(rule.platform)
    })
  })
  return Array.from(detected)
}

// 主页链接变化时自动以链接识别结果覆盖平台（以链接为准）
watch(() => [...form.links], (newLinks) => {
  const detected = detectPlatformsFromLinks(newLinks.filter(Boolean))
  if (detected.length > 0) form.platforms = detected
})

// 只有用户自己在表单里手动切换"红人类型"时才自动补默认领域（新建，或编辑时主动把
// 海外红人改成中国红人）；填充已有记录数据的过程中不触发，见 populatingFromRecord
watch(() => form.influencerType, (newType) => {
  if (populatingFromRecord) return
  if (newType === 'CHINA_INFLUENCER') {
    const current = new Set(form.domains)
    CHINA_DEFAULT_DOMAINS.forEach(d => current.add(d))
    form.domains = Array.from(current)
  }
})

function splitMulti(str) {
  if (!str) return []
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}

function contactsToObj(json) {
  const obj = EMPTY_CONTACTS()
  if (!json) return obj
  try {
    const arr = JSON.parse(json)
    arr.forEach(item => { if (item.type && obj.hasOwnProperty(item.type)) obj[item.type] = item.value })
  } catch {}
  return obj
}

function contactsToJson(obj) {
  const arr = []
  if (obj.phone)    arr.push({ type: 'phone',    value: obj.phone })
  if (obj.whatsapp) arr.push({ type: 'whatsapp', value: obj.whatsapp })
  if (obj.line)     arr.push({ type: 'line',     value: obj.line })
  if (obj.telegram) arr.push({ type: 'telegram', value: obj.telegram })
  return arr.length > 0 ? JSON.stringify(arr) : null
}

// 同时监听 visible 和 record：只监听 record 的话，连续两次都是"新建"（record 始终是 null，
// 值没变化）watch 不会重新触发，表单会残留上一次的内容。加上 visible 以后，
// 每次弹窗从关到开，不管 record 是不是跟上次一样，都会强制重新同步一次表单。
let populatingFromRecord = false
watch(() => [props.visible, props.record], ([visible, rec]) => {
  if (!visible) return
  populatingFromRecord = true   // 期间 form.influencerType 的 watch 不会顺带注入默认领域
  if (rec) {
    Object.assign(form, {
      id:             rec.id,
      influencerType: rec.influencerType || 'OVERSEAS_INFLUENCER',
      accountName:    rec.accountName    || '',
      brandTeamPairs: (rec.brandTeamPairs || []).map(p => ({ brandId: p.brandId, teamId: p.teamId })),
      countryMarkets: splitMulti(rec.countryMarket),
      platforms:      splitMulti(rec.platform),
      // 编辑已有记录：只展示这条记录本来就有的领域，不再自动叠加"中国红人"的默认领域，
      // 避免你只是打开看一眼、没注意到领域被悄悄加了默认值就点了保存
      domains:        splitMulti(rec.domains),
      followerCount:  rec.followerCount  || null,
      links:          splitMulti(rec.links),
      email:          rec.email          || '',
      contacts:       contactsToObj(rec.contacts),
      contactStatus:  rec.contactStatus  || 'UNDEVELOPED',
      followerPerson: rec.followerPerson || null,
      specialPaymentCycleDays: rec.specialPaymentCycleDays ?? null,
      influencerCost: rec.influencerCost || '',
      adSpendCost:    rec.adSpendCost    || '',
      copyrightCost:  rec.copyrightCost  || '',
      notes:          rec.notes          || ''
    })
  } else {
    Object.assign(form, {
      id:null, influencerType:'OVERSEAS_INFLUENCER', accountName:'',
      brandTeamPairs:[], countryMarkets:[], platforms:[], domains:[],
      followerCount:null, links:[],
      email:'', contacts:EMPTY_CONTACTS(),
      contactStatus:'UNDEVELOPED', followerPerson:null,
      specialPaymentCycleDays:null,
      influencerCost:'', notes:'',
      adSpendCost:'', copyrightCost:''
    })
  }
  nextTick(() => { populatingFromRecord = false })
}, { immediate: true })

function brandNameById(id) {
  if (!id) return ''
  const b = props.brands.find(b => b.id === id)
  return b ? b.name : ''
}
function teamNameById(id) {
  if (!id) return ''
  const t = props.teams.find(t => t.id === id)
  return t ? t.name : ''
}
// 团队归属唯一品牌方，下拉框必须按这一行选中的品牌方过滤，不能展示全量团队列表（2026-08 修复）
function teamsForBrand(brandId) {
  if (!brandId) return []
  return props.teams.filter(t => t.brandId === brandId)
}
// 换了品牌方之后，原来选的团队大概率不属于新品牌方了，直接清空，不留一个跟品牌方对不上的
// 团队 id 在表单里（用户之前多半也没注意到这个团队其实是别的品牌方的，是这次修复前的 bug 遗留）
function onBrandChangeInPair(pair) {
  if (!pair.teamId) return
  const stillValid = teamsForBrand(pair.brandId).some(t => t.id === pair.teamId)
  if (!stillValid) pair.teamId = null
}

async function handleAddDomain() {
  if (!newDomainName.value.trim()) return
  try {
    await domainApi.add(newDomainName.value.trim())
    message.success('领域添加成功')
    newDomainName.value = ''
    emit('domain-added')
  } catch (e) {
    message.error(e?.response?.data?.message || '添加失败')
  }
}

function isRemark(value) {
  if (!value || !value.trim()) return false
  return isNaN(parseFloat(value.trim()))
}

async function handleSave() {
  if (saving.value) return   // 防止表单校验期间（还没到 saving=true）被连续点击导致重复提交
  try { await formRef.value.validate() } catch { return }
  // "品牌方-团队"不是简单的单值字段，没法直接挂在 a-form-item 的 :rules 上校验，这里手动查
  const validPairs = form.brandTeamPairs.filter(p => p.brandId != null)
  if (validPairs.length === 0) {
    message.error('请至少选择一个"品牌方-团队"')
    return
  }
  saving.value = true
  try {
    await influencerApi.save({
      id:             form.id,
      influencerType: form.influencerType,
      accountName:    form.accountName,
      brandTeamPairs: validPairs,
      countryMarket:  form.countryMarkets.join("\n") || null,
      platform:       form.platforms.join("\n") || null,
      domains:        form.domains,
      followerCount:  form.followerCount,
      links:          form.links.filter(l => l.includes('http')),
      email:          form.email,
      contacts:       contactsToJson(form.contacts),
      contactStatus:  form.contactStatus,
      followerPerson: form.followerPerson,
      specialPaymentCycleDays: form.specialPaymentCycleDays,
      influencerCost: form.influencerCost,
      adSpendCost:    form.adSpendCost,
      copyrightCost:  form.copyrightCost,
      notes:          form.notes
    })
    message.success(form.id ? '更新成功' : '创建成功')
    // 红人合作跟踪/红人需求管理筛选栏"红人社媒完整名字"下拉框读的是同一份60秒缓存
    // （useReferenceData 的 loadInfluencersSimple），不清掉的话刚新建/改名的红人在那两个
    // 模块（以及本页自己下次打开这个下拉框时）短时间内搜不到，见 invalidateInfluencers 注释
    invalidateInfluencers()
    emit('update:visible', false)
    emit('saved')
  } finally { saving.value = false }
}

onMounted(async () => {
  employees.value = await loadEmployees()
})
</script>
