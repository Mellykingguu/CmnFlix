function toggleMenu() {
    var navMenu = document.querySelector('nav ul')
    navMenu.classList.toggle('show');
}
//Add event listener to the hambuger icon
var hambuger = document.querySelector('.hamburger');
hambuger.addEventListener('click', toggleMenu);




let searchInput = document.querySelector('.search input');
let searchButton = document.querySelector('.search button');

searchButton.addEventListener('click', (event) => {
  event.preventDefault(); // Prevent the default form submission

  if (searchInput.value.trim() === '') {
    // Input field is empty, toggle the class to set width back to 0px
    searchInput.classList.toggle('search_input');
  } else {
    // Input field has a value, submit the form
    searchInput.classList.add('search_input');
    searchInput.form.submit();
  }
});




//SCROLL BUTTONS
const scrollLeftButton = document.querySelectorAll('.scroll-left');
const scrollRightButton = document.querySelectorAll('.scroll-right');
const gridContainer = document.querySelectorAll('.grid');
//Event Listeners 
scrollLeftButton.forEach((button, index) => {
    button.addEventListener('click', () => {
        gridContainer[index].scrollLeft -=300;
    }); 
});

scrollRightButton.forEach((button, index) => {
    button.addEventListener('click', () => {
        gridContainer[index].scrollLeft +=300;
    });
});

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token'); // Assume you store JWT in local storage

  if (token) {
    // User is logged in
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('login-btn').style.display = 'none';
  } else {
    // User is logged out
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('login-btn').style.display = 'block';
  }
});

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  location.reload(); // Refresh page to update button visibility
});






// Get the back-to-top button
var backToTopBtn = document.getElementById("backToTopBtn");

// Show the button when the user scrolls down 1500px
window.onscroll = function() {
  if (document.body.scrollTop > 400 || document.documentElement.scrollTop > 400) {
    backToTopBtn.style.display = "block";
  } else {
    backToTopBtn.style.display = "none";
  }
};

// Smooth scroll to the top of the page when the button is clicked
backToTopBtn.addEventListener("click", function() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
});