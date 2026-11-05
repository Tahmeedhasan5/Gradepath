(() => {
  'use strict';

  const STORAGE_KEY = 'gradepath-v1';
  const COLORS = ['purple', 'blue', 'green', 'orange', 'pink'];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { courses: [], selectedCourseId: null, editingCourseId: null, editingAssessmentId: null, toastTimer: null };

  const makeId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // Every new visitor starts with a completely empty, personal workspace.
        state.courses = [];
        state.selectedCourseId = null;
        return;
      }

      const parsed = JSON.parse(raw);
      const savedCourses = Array.isArray(parsed) ? parsed : [];
      // Older versions installed a Biology demo course automatically. Remove
      // only untouched demo data; courses the visitor edited are kept.
      state.courses = savedCourses
        .filter(isValidCourse)
        .filter(course => !course.isDemo)
        .map(normalizeCourse);
      state.selectedCourseId = state.courses[0]?.id || null;

      // Save the cleaned format so the old demo does not return on refresh.
      if (savedCourses.some(course => course?.isDemo)) saveData();
    } catch (error) {
      console.error('Could not load saved GradePath data:', error);
      state.courses = [];
      state.selectedCourseId = null;
      showToast('Your saved data could not be read. A fresh workspace is ready; your previous browser data was not overwritten.');
      setSaveStatus('Could not read saved data', 'error');
    }
  }

  function isValidCourse(course) {
    return course && typeof course.id === 'string' && typeof course.name === 'string' && Array.isArray(course.assessments);
  }

  function normalizeCourse(course) {
    return {
      id: course.id,
      name: String(course.name).slice(0, 60),
      target: clampNumber(course.target, 0, 100, 90),
      color: COLORS.includes(course.color) ? course.color : 'purple',
      assessments: course.assessments.filter(item => item && typeof item.id === 'string').map(item => ({
        id: item.id,
        name: String(item.name || 'Untitled assessment').slice(0, 80),
        type: ['Test','Quiz','Assignment','Project','Exam','Lab','Other'].includes(item.type) ? item.type : 'Other',
        weight: clampNumber(item.weight, 0.1, 100, 10),
        score: item.score === null || item.score === '' || typeof item.score === 'undefined' ? null : clampNumber(item.score, 0, 100, 0),
        dueDate: typeof item.dueDate === 'string' ? item.dueDate : ''
      }))
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function setSaveStatus(message, status = 'saved') {
    const statusElement = $('#saveStatus');
    const textElement = $('#saveStatusText');
    if (textElement) textElement.textContent = message;
    if (statusElement) statusElement.dataset.status = status;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.courses));
      setSaveStatus('Saved privately on this device', 'saved');
      return true;
    } catch (error) {
      console.error('Could not save GradePath data:', error);
      setSaveStatus('Not saved', 'error');
      showToast('Could not save. Your browser storage may be full or disabled. Export a backup if possible.');
      return false;
    }
  }

  function getSelectedCourse() {
    return state.courses.find(course => course.id === state.selectedCourseId) || null;
  }

  function getMetrics(course) {
    const assessments = course.assessments;
    const graded = assessments.filter(item => item.score !== null);
    const upcoming = assessments.filter(item => item.score === null);
    const assignedWeight = assessments.reduce((sum, item) => sum + item.weight, 0);
    const completedWeight = graded.reduce((sum, item) => sum + item.weight, 0);
    const earnedWeightedPoints = graded.reduce((sum, item) => sum + item.score * item.weight, 0);
    const remainingWeight = Math.max(0, 100 - completedWeight);
    const currentGrade = completedWeight > 0 ? earnedWeightedPoints / completedWeight : null;
    const requiredAverage = remainingWeight > 0 ? (course.target * 100 - earnedWeightedPoints) / remainingWeight : null;
    const projectedAtCurrentPace = (earnedWeightedPoints + (currentGrade ?? 0) * remainingWeight) / 100;
    return { graded, upcoming, assignedWeight, completedWeight, earnedWeightedPoints, remainingWeight, currentGrade, requiredAverage, projectedAtCurrentPace };
  }

  function formatPercent(value, digits = 1) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(digits).replace(/\.0$/, '')}%`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function render() {
    renderSidebar();
    renderStats();
    const course = getSelectedCourse();
    const hasCourses = state.courses.length > 0;
    $('#courseSection').hidden = !hasCourses;
    $('#emptyState').hidden = hasCourses;
    if (course) renderCourse(course);
    else renderEmptyStats();
  }

  function renderSidebar() {
    const list = $('#courseList');
    list.innerHTML = state.courses.map(course => {
      const metrics = getMetrics(course);
      const grade = metrics.currentGrade === null ? '—' : formatPercent(metrics.currentGrade, 0);
      return `<button class="course-nav-item ${course.id === state.selectedCourseId ? 'active' : ''}" type="button" data-course-id="${escapeHTML(course.id)}"><span class="course-nav-dot ${course.color}"></span><span class="course-nav-name">${escapeHTML(course.name)}</span><span class="course-nav-grade">${grade}</span></button>`;
    }).join('');
  }

  function renderStats() {
    const withGrades = state.courses.map(course => getMetrics(course)).filter(metrics => metrics.currentGrade !== null);
    const average = withGrades.length ? withGrades.reduce((sum, metrics) => sum + metrics.currentGrade, 0) / withGrades.length : null;
    const upcomingCount = state.courses.reduce((sum, course) => sum + getMetrics(course).upcoming.length, 0);
    const course = getSelectedCourse();
    $('#statCourses').textContent = String(state.courses.length);
    $('#statAverage').innerHTML = average === null ? '—' : `${average.toFixed(1)}<span class="stat-unit">%</span>`;
    $('#statRemaining').textContent = String(upcomingCount);
    $('#statGoal').innerHTML = course ? `${Number(course.target).toFixed(0)}<span class="stat-unit">%</span>` : '—';
    $('#statGoalNote').textContent = course ? `Target for ${course.name}` : 'Add a course to set a goal';
    $('#currentDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  }

  function renderEmptyStats() {
    $('#statCourses').textContent = '0';
    $('#statAverage').textContent = '—';
    $('#statRemaining').textContent = '0';
    $('#statGoal').textContent = '—';
    $('#statGoalNote').textContent = 'Add a course to set a goal';
  }

  function renderCourse(course) {
    const metrics = getMetrics(course);
    $('#selectedCourseDot').className = `course-color-dot ${course.color}`;
    $('#selectedCourseName').textContent = course.name;
    $('#selectedCourseTerm').textContent = 'CURRENT COURSE';
    $('#selectedCourseSub').textContent = `${course.assessments.length} assessment${course.assessments.length === 1 ? '' : 's'} · ${formatPercent(metrics.assignedWeight, 1)} of course weight planned`;
    $('#currentGrade').innerHTML = metrics.currentGrade === null ? '—' : `${metrics.currentGrade.toFixed(1)}<span>%</span>`;
    $('#gradedWeightText').textContent = metrics.completedWeight > 0 ? `Based on ${formatPercent(metrics.completedWeight, 1)} of course weight` : 'No graded work entered yet';
    $('#courseProgressText').textContent = formatPercent(metrics.completedWeight, 0);
    $('#courseProgressBar').style.width = `${Math.min(100, metrics.completedWeight)}%`;
    $('#weightPlanText').textContent = `${formatPercent(metrics.assignedWeight, 1)} of 100% course weight planned`;
    $('#courseTargetDisplay').innerHTML = `${Number(course.target).toFixed(0)}<span>%</span>`;
    $('#targetStatusText').textContent = getTargetStatus(metrics, course.target);
    $('#assessmentCount').textContent = `${course.assessments.length} ITEM${course.assessments.length === 1 ? '' : 'S'}`;
    renderAssessments(course, metrics);
    renderPlanner(course, metrics);
    $('#goalInput').value = course.target;
    $('#goalRange').value = Math.max(50, Math.min(100, course.target));
    updateRangeFill($('#goalRange'), course.target, 50, 100, 'var(--purple)');
  }

  function getTargetStatus(metrics, target) {
    if (metrics.currentGrade === null) return 'Add grades to see your progress';
    if (metrics.remainingWeight === 0) return metrics.currentGrade >= target ? 'Target achieved!' : 'Course grading is complete';
    if (metrics.requiredAverage <= 0) return 'Target is already secured';
    if (metrics.requiredAverage > 100) return 'Target is no longer reachable';
    if (metrics.requiredAverage >= 95) return "You'll need very high scores";
    return "You're working toward it";
  }

  function renderAssessments(course, metrics) {
    const rows = $('#assessmentRows');
    if (!course.assessments.length) {
      rows.innerHTML = '<tr><td colspan="6" class="table-empty">No assessments yet. Add your first test, quiz or assignment.</td></tr>';
    } else {
      const sorted = [...course.assessments].sort((a, b) => {
        if (a.score !== null && b.score === null) return -1;
        if (a.score === null && b.score !== null) return 1;
        if (a.score === null && b.score === null) return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        return a.name.localeCompare(b.name);
      });
      rows.innerHTML = sorted.map(item => {
        const done = item.score !== null;
        const date = item.dueDate ? `<span class="assessment-date"> · ${escapeHTML(formatDate(item.dueDate))}</span>` : '';
        return `<tr>
          <td class="assessment-name">${escapeHTML(item.name)}${date}</td>
          <td><span class="assessment-type">${escapeHTML(item.type)}</span></td>
          <td class="weight-cell">${formatPercent(item.weight, 1)}</td>
          <td class="grade-cell ${done ? '' : 'grade-muted'}">${done ? formatPercent(item.score, 1) : '—'}</td>
          <td><span class="status-pill ${done ? 'done' : 'upcoming'}">${done ? 'Graded' : 'Upcoming'}</span></td>
          <td><button class="row-edit" type="button" data-assessment-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.name)}" title="Edit assessment">···</button></td>
        </tr>`;
      }).join('');
    }
    const unassigned = Math.max(0, 100 - metrics.assignedWeight);
    $('#weightFooterText').textContent = unassigned > 0.05 ? `${formatPercent(metrics.assignedWeight, 1)} assigned · ${formatPercent(unassigned, 1)} unassigned` : '100% of course weight assigned';
  }

  function renderPlanner(course, metrics) {
    const required = metrics.requiredAverage;
    const requiredElement = $('#requiredAverage');
    const requiredBox = $('#requiredBox');
    requiredElement.className = 'required-number';
    if (required === null) {
      requiredElement.innerHTML = '—';
      $('#requiredMessage').textContent = 'All course weight has been graded. Your final grade is shown above.';
    } else if (required > 100) {
      requiredElement.textContent = '100%+';
      requiredElement.classList.add('danger');
      $('#requiredMessage').textContent = `A ${course.target}% target is not mathematically reachable with the remaining ${formatPercent(metrics.remainingWeight, 1)} of the course.`;
    } else if (required <= 0) {
      requiredElement.textContent = '0%';
      $('#requiredMessage').textContent = 'Your graded work has already secured this target, even with zeroes on remaining work.';
    } else {
      requiredElement.innerHTML = `${required.toFixed(1)}<span>%</span>`;
      if (required >= 95) requiredElement.classList.add('warning');
      $('#requiredMessage').textContent = `That's the average you'll need across the remaining ${formatPercent(metrics.remainingWeight, 1)} of the course.`;
    }
    $('#goalInput').value = course.target;
    $('#goalRange').value = Math.max(50, Math.min(100, course.target));

    const whatIf = Number($('#whatIfRange').value);
    $('#whatIfValue').textContent = `${whatIf}%`;
    const projected = (metrics.earnedWeightedPoints + whatIf * metrics.remainingWeight) / 100;
    $('#projectedGrade').textContent = formatPercent(projected, 1);
    $('#projectionBar').style.width = `${Math.max(0, Math.min(100, projected))}%`;
    $('#projectionGoalMarker').style.left = `${Math.max(0, Math.min(100, course.target))}%`;
    $('#projectionNote').textContent = projectionMessage(projected, course.target, metrics.remainingWeight);
    updateRangeFill($('#whatIfRange'), whatIf, 0, 100, '#4d83d7');

    const select = $('#nextAssessmentSelect');
    const previousSelection = select.value;
    const upcoming = metrics.upcoming;
    select.innerHTML = upcoming.length ? upcoming.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)} · ${formatPercent(item.weight, 1)}</option>`).join('') : '<option value="">No upcoming assessments</option>';
    if (upcoming.some(item => item.id === previousSelection)) select.value = previousSelection;
    const otherAverage = Number($('#otherAverageRange').value);
    $('#otherAverageValue').textContent = `${otherAverage}%`;
    updateRangeFill($('#otherAverageRange'), otherAverage, 0, 100, '#23966c');
    updateNextAssessment(course, metrics);
  }

  function projectionMessage(projected, target, remainingWeight) {
    if (remainingWeight === 0) return projected >= target ? 'You have reached your target.' : 'Your course grade is finalized.';
    if (projected >= target + 0.05) return `At this pace, you'd finish ${formatPercent(projected - target, 1)} above your goal.`;
    if (projected >= target - 0.05) return 'This pace puts you right around your goal.';
    return `At this pace, you'd be ${formatPercent(target - projected, 1)} below your goal.`;
  }

  function updateNextAssessment(course, metrics) {
    const id = $('#nextAssessmentSelect').value;
    const selected = course.assessments.find(item => item.id === id && item.score === null);
    const result = $('#nextNeededScore');
    const note = $('#nextResultNote');
    result.className = '';
    if (!selected) {
      result.textContent = '—';
      note.textContent = 'Add an upcoming assessment to calculate a target score.';
      return;
    }
    const otherRemainingWeight = Math.max(0, metrics.remainingWeight - selected.weight);
    const otherAverage = Number($('#otherAverageRange').value);
    const needed = (course.target * 100 - metrics.earnedWeightedPoints - otherAverage * otherRemainingWeight) / selected.weight;
    if (needed > 100) {
      result.textContent = '100%+';
      result.classList.add('impossible');
      note.textContent = `Even 100% on this assessment would not reach your goal if you average ${otherAverage}% on the rest.`;
    } else if (needed <= 0) {
      result.textContent = '0%';
      note.textContent = `Your goal is covered if you average ${otherAverage}% on the other remaining work.`;
    } else {
      result.textContent = formatPercent(needed, 1);
      note.textContent = `Assumes ${otherAverage}% on all other remaining work, including any weight not assigned to an assessment yet.`;
    }
  }

  function updateRangeFill(input, value, min, max, color) {
    const percent = ((Number(value) - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, #eeeef4 ${percent}%, #eeeef4 100%)`;
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function openCourseDialog(course = null) {
    state.editingCourseId = course?.id || null;
    $('#courseDialogTitle').textContent = course ? 'Edit course' : 'Add a course';
    $('#courseNameInput').value = course?.name || '';
    $('#courseTargetInput').value = course?.target ?? 90;
    const color = course?.color || 'purple';
    const colorInput = $(`input[name="courseColor"][value="${color}"]`);
    if (colorInput) colorInput.checked = true;
    $('#courseFormError').textContent = '';
    $('#courseDialog').showModal();
    setTimeout(() => $('#courseNameInput').focus(), 50);
  }

  function openAssessmentDialog(assessment = null) {
    const course = getSelectedCourse();
    if (!course) return;
    state.editingAssessmentId = assessment?.id || null;
    $('#assessmentDialogTitle').textContent = assessment ? 'Edit assessment' : 'Add an assessment';
    $('#assessmentNameInput').value = assessment?.name || '';
    $('#assessmentTypeInput').value = assessment?.type || 'Test';
    $('#assessmentWeightInput').value = assessment?.weight ?? Math.min(10, Math.max(0, 100 - course.assessments.reduce((sum, item) => sum + item.weight, 0))).toFixed(1);
    $('#assessmentScoreInput').value = assessment?.score ?? '';
    $('#assessmentDateInput').value = assessment?.dueDate || '';
    $('#deleteAssessmentBtn').hidden = !assessment;
    $('#assessmentFormError').textContent = '';
    const assignedOther = course.assessments.filter(item => item.id !== assessment?.id).reduce((sum, item) => sum + item.weight, 0);
    $('#assessmentWeightHelp').textContent = `Weights are percentages of your final course grade. ${formatPercent(Math.max(0, 100 - assignedOther), 1)} is available for this assessment and any unassigned work.`;
    $('#assessmentDialog').showModal();
    setTimeout(() => $('#assessmentNameInput').focus(), 50);
  }

  function handleCourseSubmit(event) {
    event.preventDefault();
    const name = $('#courseNameInput').value.trim();
    const target = Number($('#courseTargetInput').value);
    const color = $('input[name="courseColor"]:checked')?.value || 'purple';
    const error = $('#courseFormError');
    if (!name) { error.textContent = 'Enter a course name.'; return; }
    if (!Number.isFinite(target) || target < 0 || target > 100) { error.textContent = 'Your target must be between 0 and 100.'; return; }
    if (state.editingCourseId) {
      const course = state.courses.find(item => item.id === state.editingCourseId);
      if (course) Object.assign(course, { name, target, color });
      showToast('Course updated.');
    } else {
      const course = { id: makeId(), name, target, color, assessments: [] };
      state.courses.push(course);
      state.selectedCourseId = course.id;
      showToast('Course added.');
    }
    saveData();
    $('#courseDialog').close();
    render();
  }

  function handleAssessmentSubmit(event) {
    event.preventDefault();
    const course = getSelectedCourse();
    if (!course) return;
    const name = $('#assessmentNameInput').value.trim();
    const type = $('#assessmentTypeInput').value;
    const weight = Number($('#assessmentWeightInput').value);
    const scoreRaw = $('#assessmentScoreInput').value.trim();
    const score = scoreRaw === '' ? null : Number(scoreRaw);
    const dueDate = $('#assessmentDateInput').value;
    const error = $('#assessmentFormError');
    if (!name) { error.textContent = 'Enter an assessment name.'; return; }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) { error.textContent = 'Weight must be greater than 0 and no more than 100.'; return; }
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) { error.textContent = 'Grade must be between 0 and 100.'; return; }
    const otherWeight = course.assessments.filter(item => item.id !== state.editingAssessmentId).reduce((sum, item) => sum + item.weight, 0);
    if (otherWeight + weight > 100.0001) { error.textContent = `That would bring planned course weight to ${formatPercent(otherWeight + weight, 1)}. You can only assign up to 100%.`; return; }
    if (state.editingAssessmentId) {
      const item = course.assessments.find(item => item.id === state.editingAssessmentId);
      if (item) Object.assign(item, { name, type, weight, score, dueDate });
      showToast('Assessment updated.');
    } else {
      course.assessments.push({ id: makeId(), name, type, weight, score, dueDate });
      showToast('Assessment added.');
    }
    saveData();
    $('#assessmentDialog').close();
    render();
  }

  function deleteAssessment() {
    const course = getSelectedCourse();
    if (!course || !state.editingAssessmentId) return;
    const item = course.assessments.find(item => item.id === state.editingAssessmentId);
    if (!item || !window.confirm(`Delete “${item.name}”?`)) return;
    course.assessments = course.assessments.filter(entry => entry.id !== state.editingAssessmentId);
    saveData();
    $('#assessmentDialog').close();
    render();
    showToast('Assessment deleted.');
  }

  function deleteCourse() {
    const course = getSelectedCourse();
    if (!course) return;
    if (!window.confirm(`Delete ${course.name} and all its assessments? This cannot be undone unless you exported a backup.`)) return;
    state.courses = state.courses.filter(item => item.id !== course.id);
    state.selectedCourseId = state.courses[0]?.id || null;
    saveData();
    render();
    showToast('Course deleted.');
  }

  function exportData() {
    const payload = { app: 'GradePath', version: 2, exportedAt: new Date().toISOString(), courses: state.courses };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gradepath-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded.');
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const content = JSON.parse(await file.text());
      const imported = Array.isArray(content) ? content : content.courses;
      if (!Array.isArray(imported) || !imported.every(isValidCourse)) throw new Error('This file is not a valid GradePath backup.');
      const normalized = imported.map(normalizeCourse);
      if (!window.confirm(`Import ${normalized.length} course(s)? This will replace the courses currently saved on this device.`)) return;
      state.courses = normalized;
      state.selectedCourseId = state.courses[0]?.id || null;
      saveData();
      render();
      showToast('Backup imported.');
    } catch (error) {
      showToast(error.message || 'Could not import that file.');
    }
  }

  function bindEvents() {
    $('#addCourseMainBtn').addEventListener('click', () => openCourseDialog());
    $('#addCourseLink').addEventListener('click', () => openCourseDialog());
    $('#sidebarAddBtn').addEventListener('click', () => openCourseDialog());
    $('#emptyAddCourseBtn').addEventListener('click', () => openCourseDialog());
    $('#addAssessmentBtn').addEventListener('click', () => openAssessmentDialog());
    $('#addAssessmentBottomBtn').addEventListener('click', () => openAssessmentDialog());
    $('#editCourseBtn').addEventListener('click', () => { const course = getSelectedCourse(); if (course) openCourseDialog(course); });
    $('#deleteCourseBtn').addEventListener('click', deleteCourse);
    $('#exportBtn').addEventListener('click', exportData);
    $('#importFile').addEventListener('change', importData);
    $('#printBtn').addEventListener('click', () => window.print());
    $('#courseForm').addEventListener('submit', handleCourseSubmit);
    $('#assessmentForm').addEventListener('submit', handleAssessmentSubmit);
    $('#deleteAssessmentBtn').addEventListener('click', deleteAssessment);

    $$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
    $('#courseList').addEventListener('click', event => {
      const button = event.target.closest('[data-course-id]');
      if (!button) return;
      state.selectedCourseId = button.dataset.courseId;
      render();
    });
    $('#assessmentRows').addEventListener('click', event => {
      const button = event.target.closest('[data-assessment-id]');
      if (!button) return;
      const course = getSelectedCourse();
      const item = course?.assessments.find(entry => entry.id === button.dataset.assessmentId);
      if (item) openAssessmentDialog(item);
    });
    $('#goalInput').addEventListener('change', () => updateGoal($('#goalInput').value));
    $('#goalInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); updateGoal($('#goalInput').value); $('#goalInput').blur(); } });
    $('#goalRange').addEventListener('input', event => updateGoal(event.target.value, false));
    $('#goalRange').addEventListener('change', () => saveData());
    $('#whatIfRange').addEventListener('input', () => { const course = getSelectedCourse(); if (course) renderPlanner(course, getMetrics(course)); });
    $('#otherAverageRange').addEventListener('input', () => { const course = getSelectedCourse(); if (course) renderPlanner(course, getMetrics(course)); });
    $('#nextAssessmentSelect').addEventListener('change', () => { const course = getSelectedCourse(); if (course) updateNextAssessment(course, getMetrics(course)); });
    $('#overviewNav').addEventListener('click', () => { state.selectedCourseId = state.courses[0]?.id || null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  function updateGoal(value, save = true) {
    const course = getSelectedCourse();
    if (!course) return;
    const target = Number(value);
    if (!Number.isFinite(target) || target < 0 || target > 100) {
      $('#goalInput').value = course.target;
      $('#goalRange').value = Math.max(50, Math.min(100, course.target));
      showToast('Enter a target between 0 and 100.');
      return;
    }
    course.target = Math.round(target * 10) / 10;
    $('#goalInput').value = course.target;
    $('#goalRange').value = Math.max(50, Math.min(100, course.target));
    updateRangeFill($('#goalRange'), course.target, 50, 100, 'var(--purple)');
    renderStats();
    renderCourse(course);
    if (save) saveData();
  }

  function init() {
    bindEvents();
    loadData();
    render();
    if (state.courses.length >= 0 && !$('#saveStatus')?.dataset.status) setSaveStatus('Saved privately on this device', 'saved');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
