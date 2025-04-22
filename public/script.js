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
Tu es un chef professionnel spécialisé dans la cuisine régionale. Crée un livre de recettes destiné à des lecteurs âgés de {{age}} ans.

Le livre doit obligatoirement contenir exactement **{{chapters}} chapitres**, chacun correspondant à une recette traditionnelle de la région.

Structure imposée :

1. Un **titre** : "{{bookTitle}}"
2. Le nom de l’auteur : "{{author}}"
3. Le thème principal : {{theme}}

Ajoute une **description d’image pour la couverture du livre**.

Commence le contenu par le titre et l’auteur :

[TITRE] : {{bookTitle}}
[AUTEUR] : {{author}}
[Image couverture] : ...

Chaque chapitre présente une recette avec :
- Un **titre**
- Une **image suggérée**
- Une **petite histoire ou anecdote** autour de la recette
- Les **ingrédients** nécessaires
- Les **étapes** de réalisation détaillées

Ensuite, rédige les {{chapters}} chapitres numérotés comme suit :

---
[Chapitre 1 : Titre de la recette]
Image : ...
Petite histoire ou anecdote : ...
Ingrédients : ...
Étapes :
...

---
[Chapitre 2 : Titre de la recette]
Image : ...
Petite histoire ou anecdote : ...
Ingrédients : ...
Étapes :
...

...
(Répète la structure jusqu’au chapitre {{chapters}})

Enfin, ajoute le résumé du livre :

---
[Résumé] :
...`
    : `
Tu es un auteur professionnel capable de rédiger tout type de livre selon le style suivant : {{bookType}}.

Tu dois générer un contenu immersif destiné à des lecteurs âgés de {{age}} ans.

Le livre doit contenir **exactement {{chapters}} chapitres**, chacun numéroté et structuré de manière cohérente.

Commence le contenu par le titre et l’auteur :

[TITRE] : {{bookTitle}}
[AUTEUR] : {{author}}
[Image couverture] : ...

Le thème principal est : {{theme}}

Ensuite, écris chaque chapitre en respectant ce format :

---
[Chapitre 1 : Titre]
Image : ...
Texte :
...

---
[Chapitre 2 : Titre]
Image : ...
Texte :
...

...
(Poursuis jusqu’au chapitre {{chapters}})

Enfin, ajoute le résumé du livre :

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