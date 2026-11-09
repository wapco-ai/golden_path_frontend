const genericEntrance = /^(?:(?:در|درب|درگاه|ورودی|door(?:way)?|entrance|gate|باب|بوابة|مدخل|دروازہ)(?:\s+(?:شماره[ٔ‌ی]?|نمبر|no\.?))?[\s#:-]*)?[\p{Nd}]*$/iu;
const genericArea = /^(?:(?:area|محدوده|منطقة)[\s#:-]*)?[\p{Nd}]+$/iu;
const label = value => typeof value === 'string' ? value.trim() : '';

export function withDoorStepInstructions(steps, intl) {
  return (steps || []).map(step => {
    if (step?.type !== 'stepPassDoor') return step;

    const areaName = label(step.toAreaName);
    const entrance = (label(step.doorName) || label(step.name) || label(step.originalTitle) || (!areaName ? label(step.title) : ''))
      .replace(/^عبور از\s+/, '');
    const hasEntrance = !genericEntrance.test(entrance) && entrance !== areaName;
    const sameArea = step.fromAreaId != null && step.fromAreaId === step.toAreaId;
    const hasArea = !sameArea && areaName && !genericArea.test(areaName);
    const area = intl.locale === 'fa' ? areaName.replace(/^راهرو\s+/, 'راهروی ') : areaName;
    let id = hasEntrance ? 'stepUseNamedEntrance' : 'stepContinueOnRoute';
    if (hasArea) id = hasEntrance ? 'stepEnterAreaViaEntrance' : 'stepEnterArea';

    return { ...step, instruction: intl.formatMessage({ id }, { area, entrance }) };
  });
}
