// app.js

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Obtenemos el contenedor por su ID y el mensaje de "cargando"
  const contenedorTareas = document.getElementById('task-list-container');
  const loadingMsg = document.getElementById('loading-msg');

  // 2. Usamos fetch() para pedir los datos al JSON
  fetch('tareas.json')
    .then(respuesta => respuesta.json())
    .then(tareas => {
      
      // 3. Ocultamos o quitamos el mensaje de "Cargando..."
      if (loadingMsg) {
        loadingMsg.remove();
      }

      // 4. Recorremos las tareas y creamos el HTML con TUS clases
      tareas.forEach(tarea => {
        // Creamos el div principal
        const tareaDiv = document.createElement('div');
        tareaDiv.className = 'task-item'; // Tu clase de CSS
        
        // Si la tarea está completada, añadimos la clase 'completed'
        if (tarea.completada) {
          tareaDiv.classList.add('completed');
        }

        // Creamos el checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = tarea.completada;
        checkbox.id = `task-${tarea.id}`; // Importante para el 'for' del label

        // Creamos el label
        const label = document.createElement('label');
        label.setAttribute('for', `task-${tarea.id}`); // Importante
        label.textContent = tarea.titulo;

        // Armamos la tarjeta de tarea
        tareaDiv.appendChild(checkbox);
        tareaDiv.appendChild(label);

        // 5. Agregamos la tarea al contenedor
        contenedorTareas.appendChild(tareaDiv);
      });
    })
    .catch(error => {
      console.error('Error al cargar las tareas:', error);
      if (loadingMsg) {
        loadingMsg.textContent = 'Error: No se pudieron cargar las tareas.';
      }
    });
});