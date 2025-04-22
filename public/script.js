document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('variablesForm');
  const output = document.getElementById('output');
  const promptPreview = document.getElementById('promptPreview');
  const generateBtn = document.getElementById('generateBtn');
  const confirmBtn = document.getElementById('confirmGenerationBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  let generatedPrompt = '';
  let currentValues = {};

  function buildPrompt(values) {
    const isRecipe = values.bookType?.toLowerCase().includes("recette");
    const promptTemplate = isRecipe ? `
Tu es un chef professionnel spécialisé dans la cuisine régionale. Crée un livre de recettes pour des lecteurs de {{age}} ans.

Il doit comporter :
1. Un **titre** : "{{bookTitle}}"
2. Le nom de l’auteur : "{{author}}"
3. Le thème principal est : {{theme}}

Ajoute également une **description d’image pour la couverture du livre**.

Ensuite, rédige le livre complet en {{chapters}} chapitres.
Chaque chapitre présente une recette avec :
- Un **titre**
- Une **image suggérée**
- Les **ingrédients** nécessaires
- Les **étapes** de réalisation détaillées

Enfin, ajoute un **résumé final** à la fin du livre (comme un texte de quatrième de couverture).

Format strict :
[TITRE] : ...
[AUTEUR] : ...
[Image couverture] : ...
---
[Chapitre 1 : Titre]
Image : ...
Ingrédients : ...
Étapes :
...

---
[Résumé] :
...`
    : `
Tu es un auteur professionnel capable de rédiger tout type de livre selon le style suivant : {{bookType}}.

Tu dois générer un contenu immersif destiné à des lecteurs de {{age}} ans. Il doit comporter :
1. Un **titre** : "{{bookTitle}}"
2. Le nom de l’auteur : "{{author}}"
3. Le personnage principal s'appelle "{{characterName}}" (si applicable)
4. Le thème principal est : {{theme}}

Ajoute également une **description d’image pour la couverture du livre**.

Ensuite, rédige le livre complet en {{chapters}} chapitres.
Chaque chapitre :
- Doit avoir un **titre** clair
- Commencer par une **description d’image illustrant la scène**
- Contenir un contenu immersif, avec **300 à 1500 mots minimum** par chapitre

Enfin, ajoute un **résumé final** à la fin du livre.

Format strict :
[TITRE] : ...
[AUTEUR] : ...
[Image couverture] : ...
---
[Chapitre 1 : Titre]
Image : ...
Texte :
...

---
[Résumé] :
...`;

    return promptTemplate.replace(/{{(.*?)}}/g, (_, key) => values[key.trim()] || '');
  }

  generateBtn.addEventListener('click', () => {
    const formData = new FormData(form);
    const values = {};
    for (let [key, val] of formData.entries()) values[key] = val;

    currentValues = values;
    generatedPrompt = buildPrompt(values);
    promptPreview.value = generatedPrompt;
  });

  confirmBtn.addEventListener('click', async () => {
    const costDisplay = document.getElementById('usageDisplay');
    console.log("Confirm button clicked");
    if (!generatedPrompt.trim()) return;
    console.log('📤 Prompt envoyé :', generatedPrompt);

    confirmBtn.disabled = true;
    output.value = '⏳ Génération en cours...';

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'fullBook',
          values: currentValues,
          prompt: generatedPrompt
        })
      });

      if (!res.ok) {
        const errorText = await res.text(); // lire la réponse comme texte
        throw new Error(`Erreur du serveur (${res.status}) : ${errorText}`);
      }

      const data = await res.json();
      output.value = data.result || '[⚠️ Aucun contenu retourné]';
      if (costDisplay && data.totalTokens !== undefined && data.totalCost !== undefined) {
        costDisplay.textContent = `💰 ${parseFloat(data.totalCost).toFixed(4)} $ | 🔢 ${data.totalTokens} tokens`;
        costDisplay.classList.add('bg-success', 'text-white');
        setTimeout(() => {
          costDisplay.classList.remove('bg-success', 'text-white');
        }, 1500);
      }
      downloadBtn.classList.remove('d-none');
    } catch (error) {
      output.value = '❌ Erreur lors de la génération du livre : ' + (error.message || 'Erreur inconnue.');
      console.error('❌ Erreur côté client :', error);
    } finally {
      confirmBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const content = output.value;
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'livre.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // Vérifie la disponibilité de la clé API au chargement
  fetch('/api/check-key')
    .then(res => res.json())
    .then(data => {
      const alertPlaceholder = document.getElementById('liveAlertPlaceholder');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
    <div class="alert alert-${data.success ? 'success' : 'danger'} fade show" role="alert">
      ${data.success
        ? '✅ Clé API détectée : la génération est disponible !'
        : '❌ Clé API non détectée : la génération n\'est pas disponible !'}
    </div>`;
      alertPlaceholder.append(wrapper);
      window.setTimeout(() => {
        const alertEl = wrapper.querySelector('.alert');
        if (alertEl) {
          alertEl.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
          alertEl.style.opacity = '0';
          alertEl.style.transform = 'translateY(-10px)';
          setTimeout(() => alertEl.remove(), 500);
        }
      }, 5000);
    })
    .catch(err => {
      console.warn("❌ Impossible de vérifier la clé API :", err);
    });
});