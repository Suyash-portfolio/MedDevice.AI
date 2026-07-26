(function() {
    'use strict';

    let currentReportId = null;
    let currentAnalysis = null;

    function renderReportSection() {
        const container = document.getElementById('report-analyzer-root');
        if (!container) return;

        container.innerHTML = `
            <div class="report-section glass-card">
                <div class="report-header" onclick="toggleReportSection(event)">
                    <span class="report-icon">\uD83D\uDD0D</span>
                    <span class="report-title">Medical Report Analyzer</span>
                    <span class="report-badge">AI-Powered</span>
                    <span class="report-toggle">\u25BC</span>
                </div>
                <div class="report-body" id="report-body">
                    <div class="report-dropzone" id="report-dropzone">
                        <div class="dropzone-inner">
                            <div class="dropzone-icon">\uD83D\uDCC4</div>
                            <div class="dropzone-text">Drag & drop a medical report here</div>
                            <div class="dropzone-subtext">or click to browse (JPG, PNG, PDF - max 20MB)</div>
                            <button class="glass-btn report-upload-btn" id="report-upload-btn" type="button">\uD83D\uDCC1 Upload Medical Report</button>
                            <input type="file" id="report-file-input" accept=".jpg,.jpeg,.png,.pdf" style="display:none">
                        </div>
                        <div class="upload-progress hidden" id="upload-progress">
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" id="progress-bar-fill"></div>
                            </div>
                            <div class="progress-text" id="progress-text">Uploading...</div>
                        </div>
                        <div class="file-preview hidden" id="file-preview">
                            <span class="file-preview-icon">\uD83D\uDCC4</span>
                            <span class="file-preview-name" id="file-preview-name"></span>
                            <span class="file-preview-size" id="file-preview-size"></span>
                            <button class="file-preview-clear" id="file-preview-clear" type="button" title="Remove file">\u2716</button>
                        </div>
                    </div>
                    <div class="report-actions hidden" id="report-actions">
                        <button class="glass-btn report-analyze-btn" id="report-analyze-btn" type="button">\u2699\uFE0F Analyze Report</button>
                        <button class="glass-btn report-clear-btn" id="report-clear-btn" type="button">\uD83D\uDDD1\uFE0F Clear</button>
                    </div>
                    <div class="report-error hidden" id="report-error"></div>
                    <div class="report-loading hidden" id="report-loading">
                        <div class="chat-loader-spinner"></div>
                        <div class="loading-text">Analyzing report... This may take a moment.</div>
                    </div>
                    <div class="report-results hidden" id="report-results"></div>
                </div>
            </div>
        `;

        setupDragDrop();
        setupFileInput();
        setupClearButton();
        setupAnalyzeButton();
    }

    function setupDragDrop() {
        const dropzone = document.getElementById('report-dropzone');
        const fileInput = document.getElementById('report-file-input');
        const uploadBtn = document.getElementById('report-upload-btn');

        if (!dropzone || !fileInput || !uploadBtn) return;

        uploadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            fileInput.click();
        });

        dropzone.addEventListener('click', function(e) {
            if (e.target === uploadBtn || uploadBtn.contains(e.target)) return;
            fileInput.click();
        });

        dropzone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropzone.classList.add('dropzone-active');
        });

        dropzone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropzone.classList.remove('dropzone-active');
        });

        dropzone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropzone.classList.remove('dropzone-active');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', function(e) {
            if (fileInput.files.length > 0) {
                handleFileSelect(fileInput.files[0]);
            }
        });
    }

    function setupFileInput() {
    }

    let selectedFile = null;

    function handleFileSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        const maxSize = 20 * 1024 * 1024;

        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)) {
            showReportError('Unsupported file format. Please upload JPG, JPEG, PNG, or PDF files only.');
            return;
        }

        if (file.size > maxSize) {
            showReportError('File size exceeds the maximum limit of 20 MB.');
            return;
        }

        selectedFile = file;
        const preview = document.getElementById('file-preview');
        const nameEl = document.getElementById('file-preview-name');
        const sizeEl = document.getElementById('file-preview-size');
        const dropzoneInner = document.querySelector('.dropzone-inner');
        const actions = document.getElementById('report-actions');
        const errorEl = document.getElementById('report-error');

        if (dropzoneInner) dropzoneInner.classList.add('hidden');
        if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
        if (preview) {
            nameEl.textContent = file.name;
            sizeEl.textContent = formatFileSize(file.size);
            preview.classList.remove('hidden');
        }
        if (actions) actions.classList.remove('hidden');
    }

    function setupClearButton() {
        const clearBtn = document.getElementById('report-clear-btn');
        if (!clearBtn) return;

        clearBtn.addEventListener('click', function() {
            clearAll();
        });

        const previewClear = document.getElementById('file-preview-clear');
        if (previewClear) {
            previewClear.addEventListener('click', function() {
                clearAll();
            });
        }
    }

    function clearAll() {
        selectedFile = null;
        currentReportId = null;
        currentAnalysis = null;

        const fileInput = document.getElementById('report-file-input');
        const preview = document.getElementById('file-preview');
        const dropzoneInner = document.querySelector('.dropzone-inner');
        const actions = document.getElementById('report-actions');
        const results = document.getElementById('report-results');
        const loading = document.getElementById('report-loading');
        const errorEl = document.getElementById('report-error');
        const progress = document.getElementById('upload-progress');

        if (fileInput) fileInput.value = '';
        if (preview) preview.classList.add('hidden');
        if (dropzoneInner) dropzoneInner.classList.remove('hidden');
        if (actions) actions.classList.add('hidden');
        if (results) { results.classList.add('hidden'); results.innerHTML = ''; }
        if (loading) loading.classList.add('hidden');
        if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
        if (progress) progress.classList.add('hidden');
    }

    function setupAnalyzeButton() {
        const analyzeBtn = document.getElementById('report-analyze-btn');
        if (!analyzeBtn) return;

        analyzeBtn.addEventListener('click', function() {
            if (!selectedFile) return;
            uploadAndAnalyze();
        });
    }

    async function uploadAndAnalyze() {
        if (!selectedFile) return;

        const loading = document.getElementById('report-loading');
        const results = document.getElementById('report-results');
        const errorEl = document.getElementById('report-error');
        const actions = document.getElementById('report-actions');
        const progress = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-bar-fill');
        const progressText = document.getElementById('progress-text');

        if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
        if (results) { results.classList.add('hidden'); results.innerHTML = ''; }
        if (actions) actions.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');

        let authHeaderValue = "";
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) authHeaderValue = `Bearer ${session.access_token}`;
            } catch(e) {}
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const xhr = new XMLHttpRequest();

            const result = await new Promise((resolve, reject) => {
                xhr.open('POST', '/api/report/upload', true);

                if (authHeaderValue) {
                    xhr.setRequestHeader('Authorization', authHeaderValue);
                }

                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable && progress) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progress.classList.remove('hidden');
                        if (progressFill) progressFill.style.width = pct + '%';
                        if (progressText) progressText.textContent = `Uploading... ${pct}%`;
                    }
                };

                xhr.onload = function() {
                    if (progress) progress.classList.add('hidden');
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (xhr.status === 200 && data.status === 'success') {
                            resolve(data);
                        } else {
                            reject(new Error(data.message || 'Analysis failed'));
                        }
                    } catch(e) {
                        reject(new Error('Invalid response from server'));
                    }
                };

                xhr.onerror = function() {
                    if (progress) progress.classList.add('hidden');
                    reject(new Error('Network error occurred during upload'));
                };

                xhr.send(formData);
            });

            if (loading) loading.classList.add('hidden');

            currentReportId = result.report_id;
            currentAnalysis = result.analysis;

            renderResults(result);

            sendAnalysisToChatbot(result);

            showNotification('Report analysis complete!', 'success');

        } catch (err) {
            if (loading) loading.classList.add('hidden');
            if (actions) actions.classList.remove('hidden');
            showReportError(err.message || 'An error occurred during analysis.');
        }
    }

    function renderResults(data) {
        const container = document.getElementById('report-results');
        if (!container) return;

        const analysis = data.analysis || {};
        container.classList.remove('hidden');

        let html = '<div class="report-results-grid">';

        html += renderSummaryCard(analysis.summary || 'No summary available.');
        html += renderConditionsCard(analysis.possible_conditions || []);
        html += renderValuesCard(analysis.medical_values || []);
        html += renderSymptomsCard(analysis.symptoms || []);
        html += renderDevicesCard(analysis.recommended_devices || []);
        html += renderRiskCard(analysis.risk_level || 'Unknown', analysis.risk_description || '');
        html += renderRecommendationsCard(analysis.recommendations || []);

        html += '</div>';

        html += '<div class="report-actions-bar">';
        if (data.report_id) {
            html += `<button class="glass-btn download-pdf-btn" onclick="downloadReportPDF('${data.report_id}')" type="button">\uD83D\uDCC5 Download Analysis as PDF</button>`;
        }
        html += `<button class="glass-btn new-analysis-btn" onclick="clearAll()" type="button">\uD83D\uDD03 New Analysis</button>`;
        html += '</div>';

        html += `<div class="report-disclaimer">${data.disclaimer || 'This analysis is AI-generated for informational purposes only.'}</div>`;

        container.innerHTML = html;
    }

    function renderSummaryCard(summary) {
        return `
            <div class="result-card result-card-summary">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83D\uDCDD</span>
                    <span class="result-card-title">Report Summary</span>
                </div>
                <div class="result-card-body">
                    <p>${escapeHtml(summary)}</p>
                </div>
            </div>
        `;
    }

    function renderConditionsCard(conditions) {
        if (!conditions || conditions.length === 0) return '';
        let items = conditions.map(c =>
            `<div class="condition-item">
                <span class="condition-name">${escapeHtml(c.condition || '')}</span>
                <span class="condition-note">${escapeHtml(c.note || '')}</span>
            </div>`
        ).join('');

        return `
            <div class="result-card result-card-conditions">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83D\uDD0D</span>
                    <span class="result-card-title">Possible Medical Conditions</span>
                </div>
                <div class="result-card-body">${items}</div>
                <div class="result-card-footer">These are possible findings based on the report text, not confirmed diagnoses.</div>
            </div>
        `;
    }

    function renderValuesCard(values) {
        if (!values || values.length === 0) return '';

        let rows = values.map(v => {
            const statusClass = v.is_abnormal ? 'value-abnormal' : 'value-normal';
            return `<tr class="${statusClass}">
                <td>${escapeHtml(v.name || '')}</td>
                <td>${escapeHtml(v.value || '')} ${escapeHtml(v.unit || '')}</td>
                <td>${escapeHtml(v.normal_range || '')}</td>
                <td><span class="value-status value-${(v.status || '').toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(v.status || '')}</span></td>
            </tr>`;
        }).join('');

        return `
            <div class="result-card result-card-values">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83D\uDCCA</span>
                    <span class="result-card-title">Important Medical Values</span>
                </div>
                <div class="result-card-body">
                    <table class="values-table">
                        <thead><tr>
                            <th>Parameter</th>
                            <th>Value</th>
                            <th>Normal Range</th>
                            <th>Status</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderSymptomsCard(symptoms) {
        if (!symptoms || symptoms.length === 0) return '';
        return `
            <div class="result-card result-card-symptoms">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83E\uDD12</span>
                    <span class="result-card-title">Symptoms Identified</span>
                </div>
                <div class="result-card-body">
                    <div class="symptoms-tags">${symptoms.map(s => `<span class="symptom-tag">${escapeHtml(s)}</span>`).join('')}</div>
                </div>
            </div>
        `;
    }

    function renderDevicesCard(devices) {
        if (!devices || devices.length === 0) return '';
        let items = devices.map(d => `
            <div class="device-recommend-item">
                <div class="device-rec-name">${escapeHtml(d.name || '')}</div>
                <div class="device-rec-purpose">${escapeHtml(d.purpose || '')}</div>
                <div class="device-rec-relevance">${escapeHtml(d.relevance || '')}</div>
                <div class="device-rec-risk">Risk: <span class="risk-badge risk-${(d.risk_level || '').toLowerCase()}">${escapeHtml(d.risk_level || '')}</span></div>
            </div>
        `).join('');

        return `
            <div class="result-card result-card-devices">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83C\uDFE5</span>
                    <span class="result-card-title">Recommended Medical Devices</span>
                </div>
                <div class="result-card-body">${items}</div>
            </div>
        `;
    }

    function renderRiskCard(level, description) {
        const riskClass = (level || '').toLowerCase();
        const icons = { 'high': '\u26A0\uFE0F', 'moderate': '\uD83D\uDD35', 'low': '\u2705' };
        const icon = icons[riskClass] || '\u2753';

        return `
            <div class="result-card result-card-risk">
                <div class="result-card-header">
                    <span class="result-card-icon">${icon}</span>
                    <span class="result-card-title">Risk Assessment</span>
                </div>
                <div class="result-card-body">
                    <div class="risk-level-display risk-${riskClass}">
                        <span class="risk-level-label">Risk Level:</span>
                        <span class="risk-level-value">${escapeHtml(level || 'Unknown')}</span>
                    </div>
                    <p class="risk-description">${escapeHtml(description || '')}</p>
                </div>
            </div>
        `;
    }

    function renderRecommendationsCard(recommendations) {
        if (!recommendations || recommendations.length === 0) return '';
        let items = recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('');
        return `
            <div class="result-card result-card-recommendations">
                <div class="result-card-header">
                    <span class="result-card-icon">\uD83D\uDCA1</span>
                    <span class="result-card-title">Recommendations</span>
                </div>
                <div class="result-card-body">
                    <ul class="recommendations-list">${items}</ul>
                </div>
            </div>
        `;
    }

    function sendAnalysisToChatbot(data) {
        if (typeof appendChatMessage !== 'function') return;

        const analysis = data.analysis || {};
        const summary = analysis.summary || 'No summary available.';
        const riskLevel = analysis.risk_level || 'Unknown';

        let msg = `\uD83D\uDCCB **Medical Report Analysis Complete**\n\n`;
        msg += `**Report:** ${escapeHtml(data.file_name || '')}\n`;
        msg += `**Word Count:** ${data.word_count || 0} words\n`;
        msg += `**Risk Level:** ${riskLevel}\n\n`;
        msg += `**Summary:**\n${summary}\n\n`;
        msg += `_You can ask me follow-up questions about this report, such as "What does this mean?" or "Explain my blood report."_`;

        appendChatMessage("assistant", msg, true);
    }

    function showReportError(message) {
        const errorEl = document.getElementById('report-error');
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(function() { errorEl.classList.add('hidden'); }, 8000);
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    if (typeof downloadReportPDF !== 'function') {
        window.downloadReportPDF = async function(reportId) {
            if (!reportId) return;

            let authHeaderValue = "";
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session) authHeaderValue = `Bearer ${session.access_token}`;
                } catch(e) {}
            }

            try {
                const response = await fetch(`/api/report/download/${reportId}`, {
                    headers: { 'Authorization': authHeaderValue }
                });

                if (!response.ok) {
                    const err = await response.json().catch(function() { return { message: 'Download failed' }; });
                    showNotification(err.message || 'Download failed', 'error');
                    return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${reportId}_analysis.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showNotification('PDF downloaded successfully!', 'success');
            } catch (err) {
                showNotification('Download failed: ' + err.message, 'error');
            }
        };
    }

    if (typeof toggleReportSection !== 'function') {
        window.toggleReportSection = function(e) {
            var body = document.getElementById('report-body');
            var toggle = e.currentTarget.querySelector('.report-toggle');
            if (body && toggle) {
                body.classList.toggle('report-collapsed');
                toggle.textContent = body.classList.contains('report-collapsed') ? '\u25B6' : '\u25BC';
            }
        };
    }

    if (typeof clearAll !== 'function') {
        window.clearAll = clearAll;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderReportSection);
    } else {
        renderReportSection();
    }

})();
