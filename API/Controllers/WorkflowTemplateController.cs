using System;
using System.Threading.Tasks;
using AdminManager.Core.Application.Dtos.Common;
using AdminManager.Core.Application.Dtos.Workflow;
using AdminManager.Core.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Serilog;

namespace AdminManager.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class WorkflowTemplateController : BaseController
    {
        private readonly WorkflowTemplateService _workflowTemplateService;

        public WorkflowTemplateController(WorkflowTemplateService workflowTemplateService)
        {
            _workflowTemplateService = workflowTemplateService;
        }

        [HttpPost("Search")]
        public async Task<IActionResult> Search([FromBody] SearchRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponseNoLogging(await _workflowTemplateService.Search(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpGet("{Id}")]
        public async Task<IActionResult> Get([FromRoute] IdRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _workflowTemplateService.Get(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                Guid messageId = Guid.NewGuid();
                Log.Information($"({Request.Method} {Request.Path}): {messageId}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(messageId);

                return HandleResponseNoLogging(await _workflowTemplateService.Get(messageId));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] WorkflowTemplateCreateRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _workflowTemplateService.Create(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpPost("{Id}")]
        public async Task<IActionResult> Update([FromRoute] int id, [FromBody] WorkflowTemplateUpdateRequest request)
        {
            try
            {
                request.Id = id;
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _workflowTemplateService.Update(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        [HttpDelete("{Id}")]
        public async Task<IActionResult> Delete([FromRoute] IdRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _workflowTemplateService.Delete(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }

        /// <summary>
        /// POST /api/workflowtemplate/nlp/parse
        /// Auto-Mate NLP: parses plain English into a workflow structure.
        /// </summary>
        [HttpPost("nlp/parse")]
        public async Task<IActionResult> ParseNaturalLanguage([FromBody] WorkflowNlpRequest request)
        {
            try
            {
                Log.Information($"({Request.Method} {Request.Path}): {JsonConvert.SerializeObject(request)}");

                if (!ModelState.IsValid)
                    return HandleInvalidModelState(request.MessageId);

                return HandleResponse(await _workflowTemplateService.ParseNaturalLanguage(request));
            }
            catch (Exception e)
            {
                Log.Error(e.InnerException == null ? e.ToString() : e + Environment.NewLine + e.InnerException);
                throw;
            }
        }
    }
}
