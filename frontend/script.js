// Array to store selected symptoms
        let selectedSymptoms = [];
        let uploadedFiles = [];

        // Scroll reveal animation
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        // Observe all scroll-reveal elements
        document.addEventListener('DOMContentLoaded', () => {
            const scrollElements = document.querySelectorAll('.scroll-reveal');
            scrollElements.forEach(el => observer.observe(el));
        });

        // Autocomplete dropdown element for symptom search
        const symptomSearch = document.getElementById('symptomSearch');
        const dropdown = document.createElement('div');
        dropdown.className = 'absolute bg-white border rounded shadow-md z-50 w-full max-h-52 overflow-y-auto text-left';
        dropdown.style.display = 'none';
        symptomSearch.parentElement.appendChild(dropdown);

        symptomSearch.addEventListener('input', async function() {
            const query = symptomSearch.value.trim();
            if (!query || query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            const resp = await fetch(`http://127.0.0.1:8001/symptom_suggest?query=${encodeURIComponent(query)}`);
            const data = await resp.json();
            dropdown.innerHTML = '';
            data.suggestions.forEach((sym) => {
                const item = document.createElement('div');
                item.textContent = sym;
                item.className = 'px-3 py-2 cursor-pointer hover:bg-blue-100';
                item.onclick = () => {
                    addSymptom({textContent: sym});
                    symptomSearch.value = '';
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(item);
            });
            dropdown.style.display = data.suggestions.length ? 'block' : 'none';
        });
        document.addEventListener('click', (e) => { if (!symptomSearch.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none'; });


        // Function to add symptom to selected list
        function addSymptom(button) {
            const symptom = button.textContent.trim();

            if (!selectedSymptoms.includes(symptom)) {
                selectedSymptoms.push(symptom);
                updateSelectedSymptoms();

                // Only do animation if called by a real button (DOM element)
                if (button instanceof HTMLElement && button.style) {
                    button.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        button.style.transform = '';
                    }, 150);
                }
            }
        }

        // Function to remove symptom from selected list
        function removeSymptom(symptom) {
            selectedSymptoms = selectedSymptoms.filter(item => item !== symptom);
            updateSelectedSymptoms();
        }

        // Function to update the selected symptoms display
        function updateSelectedSymptoms() {
            const container = document.getElementById('selectedSymptoms');
            
            if (selectedSymptoms.length === 0) {
                container.innerHTML = '<p class="text-gray-400 text-sm w-full">Selected symptoms will appear here...</p>';
                return;
            }
            
            container.innerHTML = '';
            
            selectedSymptoms.forEach(symptom => {
                const chip = document.createElement('div');
                chip.className = 'flex items-center bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse';
                chip.innerHTML = `
                    <span class="mr-2">${symptom}</span>
                    <button onclick="removeSymptom('${symptom}')" class="ml-2 text-white hover:text-red-200 hover:scale-110 transition-all duration-200 w-5 h-5 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                `;
                container.appendChild(chip);
                
                setTimeout(() => {
                    chip.classList.remove('animate-pulse');
                }, 1000);
            });
        }

        // Select Files button opens file dialog
        document.getElementById('selectFilesBtn').addEventListener('click', function() {
            document.getElementById('labReports').click();
        });

        // File upload handler (same as before, but clear uploadedFiles before adding)
        function handleFileUpload(event) {
            const files = event.target.files;
            const filePreview = document.getElementById('filePreview');
            filePreview.innerHTML = '';
            uploadedFiles = []; // Clear before new selection
            for (let file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    filePreview.innerHTML = '<p class="text-red-500 text-sm">Error: File size exceeds 10MB</p>';
                    uploadedFiles = [];
                    return;
                }
                if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
                    filePreview.innerHTML = '<p class="text-red-500 text-sm">Error: Unsupported file type</p>';
                    uploadedFiles = [];
                    return;
                }

                uploadedFiles.push(file);
                const previewItem = document.createElement('div');
                previewItem.className = 'flex items-center bg-green-50 p-2 rounded-lg shadow-md';
                previewItem.innerHTML = `
                    <i class="fas fa-file-alt text-green-500 mr-2"></i>
                    <span class="text-gray-700 text-sm">${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
                    <button onclick="removeFile('${file.name}')" class="ml-2 text-red-500 hover:text-red-700 text-sm">Remove</button>
                `;
                filePreview.appendChild(previewItem);
            }
        }

        // Remove file
        function removeFile(fileName) {
            uploadedFiles = uploadedFiles.filter(file => file.name !== fileName);
            // Create a new FileList for labReports input
            const dataTransfer = new DataTransfer();
            uploadedFiles.forEach(file => dataTransfer.items.add(file));
            document.getElementById('labReports').files = dataTransfer.files;
            handleFileUpload({ target: { files: dataTransfer.files } });
        }

        // Analyze Uploaded Report
        document.getElementById('extractLabBtn').onclick = async function() {
            const input = document.getElementById('labReports');
            if (!input.files.length) { alert('Please upload a file first'); return; }
            const form = new FormData();
            form.append('file', input.files[0]);
            const resp = await fetch('http://127.0.0.1:8001/analyze_lab_report', {
                method: 'POST',
                body: form
            });
            const data = await resp.json();
            if (data.error)
                document.getElementById('labExtractResult').innerHTML = `<span class="text-red-600">${data.error}</span>`;
            else
                document.getElementById('labExtractResult').innerHTML = `<pre>${data.summary}</pre>`;
        };

        // Function to analyze symptoms with enhanced UI feedback
        async function analyzeSymptoms() {
            if (selectedSymptoms.length === 0) {
                const container = document.getElementById('selectedSymptoms');
                container.classList.add('border-red-300', 'bg-red-50');
                container.innerHTML = '<p class="text-red-500 text-sm w-full animate-bounce">⚠️ Please select at least one symptom to continue</p>';
                
                setTimeout(() => {
                    container.classList.remove('border-red-300', 'bg-red-50');
                    updateSelectedSymptoms();
                }, 3000);
                return;
            }
            
            const analyzeBtn = document.querySelector('button[onclick="analyzeSymptoms()"]');
            const originalHTML = analyzeBtn.innerHTML;
            
            analyzeBtn.innerHTML = `
                <span class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    <span class="loading-dots">Analyzing with AI</span>
                </span>
            `;
            analyzeBtn.disabled = true;
            analyzeBtn.classList.add('opacity-75', 'cursor-not-allowed');
            
            try {
                const age = document.getElementById('age').value;
                const gender = document.getElementById('gender').value;
                const weight = document.getElementById('weight').value;
                const height = document.getElementById('height').value;

                const formData = new FormData();
                formData.append('symptoms', JSON.stringify(selectedSymptoms));
                if (age) formData.append('age', age);
                if (gender) formData.append('gender', gender);
                if (weight) formData.append('weight', weight);
                if (height) formData.append('height', height);
                uploadedFiles.forEach(file => formData.append('lab_reports', file));

                const response = await fetch('http://127.0.0.1:8001/predict', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'API request failed');
                }
                
                const data = await response.json();
                updateResults(data);
                
                const resultsSection = document.getElementById('predictionResults');
                resultsSection.classList.remove('hidden');
                resultsSection.style.opacity = '0';
                resultsSection.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    resultsSection.style.transition = 'all 0.6s ease';
                    resultsSection.style.opacity = '1';
                    resultsSection.style.transform = 'translateY(0)';
                    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
                
            } catch (error) {
                console.error('Error:', error);
                
                const errorModal = document.createElement('div');
                errorModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                errorModal.innerHTML = `
                    <div class="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Analysis Failed</h3>
                        <p class="text-gray-600 mb-6">${error.message || 'Unable to connect to our AI service. Please try again.'}</p>
                        <button onclick="this.parentElement.parentElement.remove()" class="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition-colors">
                            Try Again
                        </button>
                    </div>
                `;
                document.body.appendChild(errorModal);
                
                setTimeout(() => {
                    if (errorModal.parentElement) {
                        errorModal.remove();
                    }
                }, 5000);
                
            } finally {
                analyzeBtn.innerHTML = originalHTML;
                analyzeBtn.disabled = false;
                analyzeBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }

        // Function to update prediction results with enhanced animations
        function updateResults(data) {
            if (data.most_likely) {
                const conditionEl = document.getElementById('likelyCondition');
                const probabilityEl = document.getElementById('likelyProbability');
                const descriptionEl = document.getElementById('likelyDescription');
                
                conditionEl.textContent = data.most_likely.disease;
                probabilityEl.textContent = `${data.most_likely.probability}%`;
                descriptionEl.textContent = data.most_likely.description || 'No description available.';
                
                const progressBar = conditionEl.parentElement.querySelector('.bg-gradient-to-r');
                if (progressBar) {
                    progressBar.style.width = '0%';
                    setTimeout(() => {
                        progressBar.style.transition = 'width 1.5s ease';
                        progressBar.style.width = `${data.most_likely.probability}%`;
                    }, 500);
                }
            }
            
            const possibleContainer = document.getElementById('possibleConditions');
            possibleContainer.innerHTML = '';
            
            if (data.possible && data.possible.length > 0) {
                data.possible.forEach((condition, index) => {
                    const div = document.createElement('div');
                    div.className = 'bg-blue-50 p-4 rounded-xl opacity-0 transform translate-y-4';
                    div.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-semibold text-blue-700">${condition.disease}</h4>
                            <span class="text-sm font-medium text-blue-600">${condition.probability}%</span>
                        </div>
                        <div class="w-full bg-blue-200 rounded-full h-2">
                            <div class="bg-blue-500 h-2 rounded-full transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    `;
                    possibleContainer.appendChild(div);
                    
                    setTimeout(() => {
                        div.style.transition = 'all 0.5s ease';
                        div.style.opacity = '1';
                        div.style.transform = 'translateY(0)';
                        
                        const progressBar = div.querySelector('.bg-blue-500');
                        setTimeout(() => {
                            progressBar.style.width = `${condition.probability}%`;
                        }, 200);
                    }, index * 200 + 800);
                });
            } else {
                possibleContainer.innerHTML = '<p class="text-gray-600 italic">No other significant predictions found</p>';
            }

            const recommendationsContainer = document.getElementById('recommendations');
            if (data.recommendations && data.recommendations.length > 0) {
                recommendationsContainer.innerHTML = '';
                const colors = ['purple-50', 'blue-50', 'red-50', 'green-50'];
                const icons = ['fa-bed', 'fa-pills', 'fa-user-md', 'fa-vial'];
                data.recommendations.forEach((rec, index) => {
                    const li = document.createElement('li');
                    li.className = `flex items-start bg-${colors[index % colors.length]} p-3 rounded-xl`;
                    li.innerHTML = `
                        <i class="fas ${icons[index % icons.length]} text-${colors[index % colors.length].split('-')[0]}-500 mt-1 mr-3 flex-shrink-0"></i>
                        <span class="text-gray-700">${rec}</span>
                    `;
                    recommendationsContainer.appendChild(li);
                });
            }
            // Show model explanation in a dedicated section
            if (data.explanation) {
                let explDiv = document.getElementById('explanationTextBlock');
                if (!explDiv) {
                    explDiv = document.createElement('div');
                    explDiv.id = 'explanationTextBlock';
                    explDiv.className = "bg-blue-50 border-l-4 border-blue-400 p-4 my-4 rounded text-blue-900";
                    // Insert above or below '#predictionResults' or inside your '.glass-effect' card
                    document.querySelector('#predictionResults .glass-effect').appendChild(explDiv);
                }
                explDiv.innerHTML = `<b>Why this prediction?</b> <br>${data.explanation}`;
            }
        }

        // Function to calculate BMI
        document.getElementById('calcBMI').addEventListener('click', () => {
            const weight = parseFloat(document.getElementById('weight').value);
            const height = parseFloat(document.getElementById('height').value);
            const resultElement = document.getElementById('bmiResult');

            if (!weight || !height || weight <= 0 || height <= 0) {
                resultElement.textContent = 'Please enter valid weight and height.';
                resultElement.classList.add('text-red-500');
                return;
            }

            const bmi = weight / ((height / 100) ** 2);
            let category = '';
            if (bmi < 18.5) category = 'Underweight';
            else if (bmi < 25) category = 'Normal';
            else if (bmi < 30) category = 'Overweight';
            else category = 'Obese';

            resultElement.textContent = `BMI: ${bmi.toFixed(1)} (${category})`;
            resultElement.classList.remove('text-red-500');
            resultElement.classList.add('text-green-600');
        });

        // Function to download report as PDF
        function downloadReport() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const date = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            doc.setFontSize(20);
            doc.text('AI Doctor Assistant - Health Report', 105, 20, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Generated on: ${date}`, 105, 30, { align: 'center' });

            doc.setFontSize(16);
            doc.text('Personal Information', 20, 50);
            const age = document.getElementById('age').value || 'N/A';
            const gender = document.getElementById('gender').value || 'N/A';
            const weight = document.getElementById('weight').value || 'N/A';
            const height = document.getElementById('height').value || 'N/A';
            doc.text(`Age: ${age} | Gender: ${gender} | Weight: ${weight} kg | Height: ${height} cm`, 20, 60);

            const bmiResult = document.getElementById('bmiResult').textContent || 'N/A';
            if (bmiResult !== 'N/A') doc.text(`BMI: ${bmiResult}`, 20, 70);

            doc.text('Symptoms', 20, 90);
            doc.text(selectedSymptoms.join(', ') || 'None', 20, 100);

            const likelyCondition = document.getElementById('likelyCondition').textContent || 'N/A';
            const likelyProbability = document.getElementById('likelyProbability').textContent || 'N/A';
            doc.text('Prediction Results', 20, 120);
            doc.text(`Most Likely Condition: ${likelyCondition} (${likelyProbability})`, 20, 130);

            const possibleConditions = Array.from(document.querySelectorAll('#possibleConditions h4')).map(el => el.textContent).join(', ') || 'None';
            doc.text(`Possible Conditions: ${possibleConditions}`, 20, 140);

            const recommendations = Array.from(document.querySelectorAll('#recommendations span')).map(el => el.textContent).join(', ') || 'None';
            doc.text('Recommendations', 20, 160);
            doc.text(recommendations, 20, 170);

            doc.save(`Health_Report_${date.split(',')[0].replace(/\//g, '-')}.pdf`);
        }

        // Add floating particles effect
        function createFloatingParticle() {
            const particle = document.createElement('div');
            particle.className = 'fixed w-2 h-2 bg-blue-400 rounded-full opacity-30 pointer-events-none z-0';
            particle.style.left = Math.random() * window.innerWidth + 'px';
            particle.style.top = window.innerHeight + 'px';
            
            document.body.appendChild(particle);
            
            const animation = particle.animate([
                { transform: 'translateY(0px) scale(1)', opacity: 0.3 },
                { transform: `translateY(-${window.innerHeight + 100}px) scale(0)`, opacity: 0 }
            ], {
                duration: Math.random() * 3000 + 2000,
                easing: 'ease-out'
            });
            
            animation.onfinish = () => particle.remove();
        }

        // Create particles periodically
        setInterval(createFloatingParticle, 3000);

        // Enhanced smooth scrolling for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Add typing effect for hero text
        function typeWriter() {
            const text = "Smart Health Prediction System";
            const heroText = document.querySelector('.hero-gradient h2');
            let i = 0;
            let speed = 100; // Typing speed in milliseconds

            function type() {
                if (i < text.length) {
                    heroText.innerHTML += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    // Add blinking cursor effect after typing
                    heroText.innerHTML += '<span class="blink">_</span>';
                }
            }

            // Start typing
            heroText.innerHTML = '';
            type();
        }

        // Initialize typing effect when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            typeWriter();

            // Ensure all scroll-reveal elements are observed (already handled above, but reinforcing)
            const scrollElements = document.querySelectorAll('.scroll-reveal');
            scrollElements.forEach(el => observer.observe(el));
        });
        
        // Smooth scroll both hero and CTA buttons
        document.getElementById('scrollToAnalysis1')?.addEventListener('click', function() {
            document.getElementById('analysis-tool')?.scrollIntoView({behavior: 'smooth'});
        });
        document.getElementById('scrollToAnalysis2')?.addEventListener('click', function() {
            document.getElementById('analysis-tool')?.scrollIntoView({behavior: 'smooth'});
        });