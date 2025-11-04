// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');
  const fabButton = document.querySelector('.fab');

  // --- Función para guardar tareas en localStorage ---
  function guardarTareas(tareas) {
    localStorage.setItem('misTareas', JSON.stringify(tareas));
  }

  // --- Función para cargar tareas (desde localStorage o JSON) ---
  function cargarTareas() {
    const tareasGuardadas = localStorage.getItem('misTareas');
    
    if (tareasGuardadas) {
      // Si hay tareas en localStorage, usa esas
      renderizarTareas(JSON.parse(tareasGuardadas));
    } else {
      // Si es la primera vez, carga las del JSON
      fetch('tareas.json')
        .then(respuesta => respuesta.json())
        .then(tareas => {
          guardarTareas(tareas); // Guárdalas para la próxima vez
          renderizarTareas(tareas);
        })
        .catch(error => {
          console.error('Error al cargar tareas iniciales:', error);
          if (loadingMsg) loadingMsg.textContent = 'Error al cargar tareas.';
        });
    }
  }

  // --- Función para "dibujar" las tareas en el HTML ---
  function renderizarTareas(tareas) {
    // 1. Limpia el contenedor (y el mensaje de "cargando")
    contenedorTareas.innerHTML = ''; 

    // 2. Recorre las tareas y crea el HTML
    tareas.forEach(tarea => {
      const tareaDiv = document.createElement('div');
      tareaDiv.className = 'task-item';
      if (tarea.completada) {
        tareaDiv.classList.add('completed');
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = tarea.completada;
      checkbox.id = `task-${tarea.id}`;
      // (Opcional) Guardar cambio de estado
      checkbox.addEventListener('change', () => {
        tarea.completada = checkbox.checked;
        guardarTareas(tareas);
        renderizarTareas(tareas); // Vuelve a dibujar para tachar
      });

      const label = document.createElement('label');
      label.setAttribute('for', `task-${tarea.id}`);
      label.textContent = tarea.titulo;

      tareaDiv.appendChild(checkbox);
      tareaDiv.appendChild(label);
      contenedorTareas.appendChild(tareaDiv);
    });
  }

  // --- Lógica del botón FAB (+) ---
  fabButton.addEventListener('click', () => {
    const titulo = prompt('Escribe el título de la nueva tarea:');
    
    if (titulo && titulo.trim() !== '') {
      // 1. Carga las tareas actuales
      const tareasActuales = JSON.parse(localStorage.getItem('misTareas')) || [];
      
      // 2. Crea la nueva tarea
      const nuevaTarea = {
        id: Date.now(), // ID único basado en la fecha
        titulo: titulo.trim(),
        completada: false
      };

      // 3. Añade la nueva tarea al arreglo
      tareasActuales.push(nuevaTarea);
      
      // 4. Guarda el arreglo actualizado
      guardarTareas(tareasActuales);
      
      // 5. Vuelve a dibujar la lista
      renderizarTareas(tareasActuales);
    }
  });

  // --- Carga inicial ---
  cargarTareas();
});